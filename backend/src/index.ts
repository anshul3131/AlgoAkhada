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
import { customMatchService } from "./domain/services/CustomMatchService";
import { matchRepository } from "./infrastructure/database/repositories/MatchRepository";

import { customMatchRepository } from "./infrastructure/database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository } from "./infrastructure/database/repositories/CustomMatchParticipantRepository";
import { MatchStatus } from "./domain/enums/MatchStatus";
import { userRepository } from "./infrastructure/database/repositories/UserRepository";

import { CustomParticipantStatus } from "./domain/enums/CustomParticipantStatus";

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
                const roomSize = io.sockets.adapter.rooms.get(matchRoom)?.size || 0;
                const spectatorCount = Math.max(0, roomSize - 2);
                io.to(matchRoom).emit('spectator_count', spectatorCount);
            });

            socket.on('leave_match', (matchId: string) => {
                const matchRoom = `match:${matchId}`;
                socket.leave(matchRoom);
                console.log(`Socket ${socket.id} left match room: ${matchRoom}`);
                const roomSize = io.sockets.adapter.rooms.get(matchRoom)?.size || 0;
                const spectatorCount = Math.max(0, roomSize - 2);
                io.to(matchRoom).emit('spectator_count', spectatorCount);
            });

            socket.on('match_code_update', (data: { matchId: string, code: string, language: string }) => {
                const userId = socket.data.user?.id;
                if (!userId || !data.matchId) return;
                socket.to(`match:${data.matchId}`).emit('spectator_code_update', {
                    userId,
                    username: socket.data.user?.username,
                    code: data.code,
                    language: data.language
                });
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

            socket.on('forfeit_match', async (matchId: string) => {
                const userId = socket.data.user?.id;
                if (!userId || !matchId) return;

                await matchService.finishMatchByTimeout(matchId, userId);
            });

            socket.on('propose_rematch', async (data: { matchId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId || !data.matchId) return;

                const match = await matchRepository.findOne({ where: { id: data.matchId }, relations: { user1: true, user2: true, problem: true } });
                if (!match) return;

                const opponentId = match.user1.id === userId ? match.user2.id : match.user1.id;
                const rematchKey = `rematch:${data.matchId}`;
                const existing = await redisClient.client.get(rematchKey);

                if (existing && existing !== userId) {
                    await redisClient.client.del(rematchKey);
                    
                    const tag = match.problem?.tags?.[0] || 'GENERIC';
                    await matchmakerService.createMatch(userId, opponentId, tag);
                } else {
                    await redisClient.client.set(rematchKey, userId, { EX: 60 });
                    io.to(`user:${opponentId}`).emit('rematch_requested');
                }
            });

            socket.on('decline_rematch', async (data: { matchId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId || !data.matchId) return;
                const match = await matchRepository.findOne({ where: { id: data.matchId }, relations: { user1: true, user2: true } });
                if (!match) return;
                const opponentId = match.user1.id === userId ? match.user2.id : match.user1.id;
                const rematchKey = `rematch:${data.matchId}`;
                await redisClient.client.del(rematchKey);
                io.to(`user:${opponentId}`).emit('rematch_declined');
            });

            socket.on('custom_lobby_leave_match', async (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId || !data.lobbyId) return;

                const match = await customMatchRepository.getMatchById(data.lobbyId);
                if (match) {
                    const participant = match.participants?.find(p => p.user.id === userId);
                    if (participant) {
                        participant.status = CustomParticipantStatus.FORFEITED;
                        await customMatchParticipantRepository.saveEntity(participant);

                        io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_submission', {
                            lobbyId: data.lobbyId,
                            userId,
                            username: participant.user.username,
                            status: 'LEFT',
                            score: participant.score
                        });
                    }
                }
            });

            socket.on('leave_queue', async () => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                await matchmakerService.removeFromQueue(userId);
                socket.emit('queue_status', { status: 'left' });
                console.log(`User ${userId} left the queue.`);
            });
            const broadcastPublicLobbies = async () => {
                const res = await customMatchService.getPublicLobbies();
                io.emit('public_lobbies_updated', res.data);
            };

            // --- Custom Lobbies ---
            socket.on('custom_lobby_create', async (data: { topic: string, timeLimit: number, maxParticipants: number, name?: string, difficulty?: string, isPublic?: boolean }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                
                const response = await customMatchService.createLobby(userId, data.topic, data.timeLimit, data.maxParticipants, data.name, data.difficulty, data.isPublic);
                if (response.responseCode < 400 && response.data) {
                    const lobbyId = response.data.id;
                    socket.join(`lobby:${lobbyId}`);
                    socket.emit('custom_lobby_updated', response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit('error', { message: response.data || 'Failed to create lobby' });
                }
            });

            socket.on('custom_lobby_update', async (data: { lobbyId: string, topic: string, timeLimit: number, maxParticipants: number, isPublic?: boolean }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                const response = await customMatchService.updateLobby(data.lobbyId, userId, data);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_updated', response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit('error', { message: response.data || 'Failed to update lobby' });
                }
            });

            socket.on('custom_lobby_invite', (data: { lobbyId: string, invitedUserId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                // Emit to the specific user's socket room
                io.to(`user:${data.invitedUserId}`).emit('custom_lobby_invite_received', {
                    lobbyId: data.lobbyId,
                    inviterId: userId,
                    inviterUsername: socket.data.user.username
                });
            });

            socket.on('custom_lobby_join', async (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                
                const response = await customMatchService.joinLobby(data.lobbyId, userId);
                if (response.responseCode < 400 && response.data) {
                    socket.join(`lobby:${data.lobbyId}`);
                    // Broadcast updated lobby to everyone in the room
                    io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_updated', response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit('error', { message: response.data || 'Failed to join lobby' });
                }
            });

            socket.on('custom_lobby_join_by_code', async (data: { joinCode: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                const response = await customMatchService.joinLobbyByCode(data.joinCode, userId);
                if (response.responseCode < 400 && response.data) {
                    socket.join(`lobby:${response.data.id}`);
                    io.to(`lobby:${response.data.id}`).emit('custom_lobby_updated', response.data);
                    broadcastPublicLobbies();
                    socket.emit('custom_lobby_joined', response.data);
                } else {
                    socket.emit('error', { message: response.data || 'Failed to join lobby' });
                }
            });

            socket.on('custom_lobby_decline', (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                // Notify the lobby that this user declined
                io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_declined', {
                    lobbyId: data.lobbyId,
                    declinerId: userId
                });
            });
            socket.on('custom_lobby_timeout', async (data: { lobbyId: string }) => {
                const match = await customMatchRepository.getMatchById(data.lobbyId);
                
                if (match && match.status !== MatchStatus.FINISHED) {
                    match.status = MatchStatus.FINISHED;
                    await customMatchRepository.saveEntity(match);
                }

                const leaderboard = (match?.participants || []).map(p => ({
                    userId: p.user.id,
                    username: p.user.username,
                    score: p.score || 0
                })).sort((a, b) => b.score - a.score);

                io.to(`lobby:${data.lobbyId}`).emit('custom_match_result', {
                    lobbyId: data.lobbyId,
                    result: 'timeout',
                    leaderboard
                });
            });

            socket.on('custom_lobby_leave', async (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                socket.leave(`lobby:${data.lobbyId}`);
                const response = await customMatchService.leaveLobby(data.lobbyId, userId);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_updated', response.data);
                    broadcastPublicLobbies();
                    io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_left', { lobbyId: data.lobbyId, userId });
                }
            });

            socket.on('custom_lobby_start', async (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                const response = await customMatchService.startMatch(data.lobbyId, userId);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit('custom_match_started', response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit('error', { message: response.data || 'Failed to start match' });
                }
            });

            socket.on('custom_lobby_chat_message', async (data: { lobbyId: string, message: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                const user = await userRepository.getUserById(userId);
                if (!user) return;

                io.to(`lobby:${data.lobbyId}`).emit('custom_lobby_chat_message', {
                    userId,
                    username: user.username,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
            });

            socket.on('custom_lobby_chat_typing', (data: { lobbyId: string, isTyping: boolean }) => {
                const userId = socket.data.user?.id;
                if (!userId || !data.lobbyId) return;

                socket.to(`lobby:${data.lobbyId}`).emit('custom_lobby_chat_typing', {
                    userId,
                    username: socket.data.user?.username,
                    isTyping: data.isTyping
                });
            });

            // WebRTC Signaling
            socket.on('webrtc_offer', (data: { targetUserId: string, lobbyId: string, offer: RTCSessionDescriptionInit }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                io.to(`user:${data.targetUserId}`).emit('webrtc_offer', {
                    senderId: userId,
                    offer: data.offer
                });
            });

            socket.on('webrtc_answer', (data: { targetUserId: string, lobbyId: string, answer: RTCSessionDescriptionInit }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                io.to(`user:${data.targetUserId}`).emit('webrtc_answer', {
                    senderId: userId,
                    answer: data.answer
                });
            });

            socket.on('webrtc_ice_candidate', (data: { targetUserId: string, lobbyId: string, candidate: RTCIceCandidateInit }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;
                io.to(`user:${data.targetUserId}`).emit('webrtc_ice_candidate', {
                    senderId: userId,
                    candidate: data.candidate
                });
            });

            socket.on('custom_lobby_forfeit', async (data: { lobbyId: string }) => {
                const userId = socket.data.user?.id;
                if (!userId) return;

                await customMatchService.forfeitMatch(data.lobbyId, userId);
                io.to(`user:${userId}`).emit('custom_match_result', { lobbyId: data.lobbyId, result: 'FORFEIT' });
            });

            socket.on('disconnecting', () => {
                for (const room of socket.rooms) {
                    if (room.startsWith('match:')) {
                        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
                        const spectatorCount = Math.max(0, roomSize - 1 - 2);
                        io.to(room).emit('spectator_count', spectatorCount);
                    }
                }
            });
        });

        // The Bridge: Listen to our internal Event Emitter
        appEvents.on('submission_graded', (resultData) => {
            // Blast the result ONLY to the user sitting in this specific submission's room
            console.log(`🚀Event With Submission Id : ${resultData.submissionId} fired`)
            io.to(resultData.submissionId).emit('evaluation_complete', resultData);
        });

        appEvents.on('custom_submission_graded', (resultData) => {
            io.to(`lobby:${resultData.lobbyId}`).emit('custom_lobby_submission', resultData);
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