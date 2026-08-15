import "reflect-metadata";
import * as http from "http";
import app from "./app";
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AppDataSource } from "./infrastructure/database/data_source";
import { kafkaProducerClient } from "./infrastructure/kafka/KafkaProducerClient";
import { kafkaConsumerClient } from "./infrastructure/kafka/KafkaConsumerClient";
import { appEvents } from "./utils/EventEmitter";
import { redisClient } from "./infrastructure/redis/RedisClient";
import { matchmakerService } from "./domain/services/MatchmakerService";
import { matchService } from "./domain/services/MatchService";

async function startServer(): Promise<void> {
    let server: http.Server | null = null; // 1. Declare server variable here for proper scoping

    // Define the shutdown logic in a clean, accessible scope
    const handleShutdown = (signal: string) => {
        console.log(`\n🛑 ${signal} received: Starting graceful shutdown...`);

        const timeout = setTimeout(() => {
            console.error("❌ Forced shutdown: Could not close connections within 10s.");
            process.exit(1);
        }, 5000);

        const closeConnections = async () => {
            clearTimeout(timeout);
            try {
                // Safely disconnect Kafka with a timeout guard
                await Promise.race([
                    Promise.all([
                        kafkaProducerClient.gracefulShutdown(),
                        kafkaConsumerClient.gracefulShutdown()
                    ]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Kafka disconnect timeout")), 4000))
                ]);
            } catch (err: any) {
                console.error("⚠️ Warning during Kafka disconnect:", err.message);
            }

            console.log("🏁 Cleanup finished. Exiting process.");
            process.exit(0);
        };

        // If the HTTP server was successfully spun up, close it gracefully first
        if (server) {
            server.close(() => {
                console.log("🏁 HTTP server closed successfully.");
                closeConnections();
            });
        } else {
            // If the server never started (e.g., DB failed), just clean up connections
            closeConnections();
        }
        
        redisClient.disconnect();
        matchmakerService.stopLoop();
    };

    // Catch system signals early
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    try {
        // 2. Initialize Infrastructure
        await AppDataSource.initialize();
        console.log("✅ Database connection established successfully.");

        // Connect the Kafka Producer before accepting HTTP traffic
        await kafkaProducerClient.connect();
        console.log("✅ Kafka Producer connected successfully.");

        // Connect the Kafka Consumer before accepting HTTP traffic
        await kafkaConsumerClient.connectAndSubscribe();
        console.log("✅ Kafka Consumer connected successfully.");

        // Connect Redis and Start Matchmaker Loop
        await redisClient.connect();
        console.log("✅ Redis connected successfully.");
        matchmakerService.startLoop();

        // 3. Create and start the HTTP Server
        server = http.createServer(app); // Assign to the outer variable
        const PORT: number = Number(process.env.PORT) || 3000;

        server.keepAliveTimeout = 61 * 1000;


        // Initialize WebSockets
        const io = new Server(server, {
            cors: { origin: "*" } // Configure this securely in production
        });

        io.use((socket, next) => {
            // Because we switched to HttpOnly cookies, the token is now in the 'cookie' header!
            // We need to parse the raw cookie string to find the 'accessToken'.
            let token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];
            
            // If not found in auth/header, check the cookies!
            if (!token && socket.handshake.headers.cookie) {
                const cookies = socket.handshake.headers.cookie.split(';');
                const accessTokenCookie = cookies.find(c => c.trim().startsWith('accessToken='));
                if (accessTokenCookie) {
                    token = accessTokenCookie.split('=')[1];
                }
            }

            if (!token) {
                return next(new Error('Authentication error: Token missing'));
            }
            try {
                const secret = process.env.JWT_SECRET || 'super_secret_fallback_key';
                const decodedToken = jwt.verify(token, secret) as any;
                socket.data.user = decodedToken;
                next();
            } catch (err) {
                next(new Error('Authentication error: Invalid token'));
            }
        });

        // When a client connects...
        io.on('connection', (socket) => {
            const userId = socket.data.user?.id;
            if (userId) {
                const userRoom = `user:${userId}`;
                socket.join(userRoom);
                console.log(`User ${userId} connected and joined room: ${userRoom}`);
            }

            console.log(`User connected to WebSockets: ${socket.id}`);

            // Frontend tells the server which submission to watch
            socket.on('subscribeToSubmission', (submissionId: string) => {
                // Socket.io "rooms" are perfect for this. We put the user in a room named after the ID.
                socket.join(submissionId);
                console.log(`Socket ${socket.id} is listening for submission: ${submissionId}`);
            });

            socket.on('join_match', (matchId: string) => {
                const matchRoom = `match:${matchId}`;
                socket.join(matchRoom);
                console.log(`Socket ${socket.id} joined match room: ${matchRoom}`);
            });

            socket.on('join_queue', async (data?: { tag?: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                
                const tag = data?.tag;
                
                await kafkaProducerClient.sendMessage('matchmaking-requests', {
                    userId: userId,
                    tag: tag
                });
                
                socket.emit('queue_status', { status: 'waiting' });
                console.log(`User ${userId} joined the queue${tag ? ` [${tag}]` : ''}.`);
            });

            socket.on('match_timeout', async (matchId: string) => {
                const userId = socket.data.user?.id;
                if (!userId || !matchId) return;

                await matchService.finishMatchByTimeout(matchId, userId);
            });

            socket.on('leave_queue', async () => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                await matchmakerService.removeFromQueue(userId);
                socket.emit('queue_status', { status: 'left' });
                console.log(`User ${userId} left the queue.`);
            });
        });

        // The Bridge: Listen to our internal Event Emitter
        appEvents.on('submission_graded', (resultData) => {
            // Blast the result ONLY to the user sitting in this specific submission's room
            console.log(`🚀Event With Submission Id : ${resultData.submissionId} fired`)
            io.to(resultData.submissionId).emit('evaluation_complete', resultData);
        });

        // Matchmaking Events
        appEvents.on('queue_status', (data) => {
            io.to(`user:${data.userId}`).emit('queue_status', data);
        });

        appEvents.on('match_found', (data) => {
            io.to(`user:${data.user1Id}`).emit('match_found', data);
            io.to(`user:${data.user2Id}`).emit('match_found', data);
        });

        appEvents.on('opponent_status', (data) => {
            io.to(`match:${data.matchId}`).emit('opponent_status', data);
        });

        appEvents.on('match_result', (data) => {
            io.to(`match:${data.matchId}`).emit('match_result', data);
        });

        appEvents.on('elo_update', (data) => {
            io.to(`user:${data.userId}`).emit('elo_update', data);
        });

        server.listen(PORT, '0.0.0.0',() => {
            console.log(`🚀 Server is running on http://localhost:${PORT}...`);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ Fatal error during server startup:", error.message);
        } else {
            console.error("❌ Fatal error during server startup:", error);
        }
        // Force clean up if startup fails after some components connected
        handleShutdown("STARTUP_FAILURE");
    }
}

startServer();