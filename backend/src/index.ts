/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Main backend server entry point, database/kafka/redis lifecycle, and Socket.IO initialization
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import "reflect-metadata";
import * as http from "http";
import app from "./app";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { AppDataSource } from "./infrastructure/database/data_source";
import { kafkaProducerClient } from "./infrastructure/kafka/KafkaProducerClient";
import { kafkaConsumerClient } from "./infrastructure/kafka/KafkaConsumerClient";
import { appEvents } from "./utils/EventEmitter";
import { redisCache } from "./infrastructure/redis/RedisCache";
import { RedisKeys } from "./infrastructure/redis/RedisConstants";
import { matchmakerService } from "./domain/services/MatchmakerService";
import { matchService } from "./domain/services/MatchService";
import { customMatchService } from "./domain/services/CustomMatchService";
import { dashboardService } from "./domain/services/DashboardService";
import { matchRepository } from "./infrastructure/database/repositories/MatchRepository";
import { customMatchRepository } from "./infrastructure/database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository } from "./infrastructure/database/repositories/CustomMatchParticipantRepository";
import { MatchStatus } from "./domain/enums/MatchStatus";
import { userRepository } from "./infrastructure/database/repositories/UserRepository";
import { CustomParticipantStatus } from "./domain/enums/CustomParticipantStatus";
import { logger } from "./utils/LogglyClient";
import { ErrorLoggingUtils } from "./utils/ErrorLoggingUtils";
import { COOKIE_NAMES } from "./constants/AuthConstants";
import { KafkaTopics, KafkaEvents } from "./constants/KafkaConstants";
import { _DAY_MS, _SECOND_MS, ZERO, TWO } from "./constants/AppConstant";
import { cacheExpirySeconds } from "./constants/CacheConstants";

async function startServer(): Promise<void> {
    let server: http.Server | null = null;

    const handleShutdown = (signal: string) => {
        logger.info(`🛑 ${signal} received: Starting graceful shutdown...`);

        const timeout = setTimeout(() => {
            logger.error("❌ Forced shutdown: Could not close connections within 10s.");
            process.exit(1);
        }, 10 * _SECOND_MS);

        const closeConnections = async () => {
            clearTimeout(timeout);
            try {
                await Promise.race([
                    Promise.all([
                        kafkaProducerClient.gracefulShutdown(),
                        kafkaConsumerClient.gracefulShutdown(),
                        redisCache.disconnect()
                    ]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Cleanup disconnect timeout")), 4 * _SECOND_MS))
                ]);
            } catch (err: any) {
                ErrorLoggingUtils.logError(err, "ServerLifecycle", "closeConnections");
            }

            logger.info("🏁 Cleanup finished. Exiting process.");
            process.exit(0);
        };

        if (server) {
            server.close(() => {
                logger.info("🏁 HTTP server closed successfully.");
                closeConnections();
            });
        } else {
            closeConnections();
        }
        
        matchmakerService.stopLoop();
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    try {
        await AppDataSource.initialize();
        logger.info("✅ Database connection established successfully.");

        await kafkaProducerClient.connect();
        logger.info("✅ Kafka Producer connected successfully.");

        await kafkaConsumerClient.connectAndSubscribe();
        logger.info("✅ Kafka Consumer connected successfully.");

        await redisCache.connect();
        logger.info("✅ Redis connected successfully.");
        matchmakerService.startLoop();

        server = http.createServer(app);
        const PORT: number = Number(process.env.PORT) || 3000;

        server.keepAliveTimeout = 61 * _SECOND_MS;

        const io = new Server(server, {
            cors: {
                origin: true,
                credentials: true,
                maxAge: _DAY_MS / _SECOND_MS
            }
        });

        const broadcastPublicLobbies = async () => {
            try {
                const res = await customMatchService.getPublicLobbies();
                io.emit("public_lobbies_updated", res.data);
            } catch (err: any) {
                ErrorLoggingUtils.logError(err, "SocketServer", "broadcastPublicLobbies");
            }
        };

        const broadcastLiveMatches = async () => {
            try {
                const res = await dashboardService.getLiveMatches();
                if (res.responseCode < 400 && res.data) {
                    io.emit("live_matches_updated", res.data);
                }
            } catch (err: any) {
                ErrorLoggingUtils.logError(err, "SocketServer", "broadcastLiveMatches");
            }
        };

        io.use((socket, next) => {
            let token = socket.handshake.auth?.token || socket.handshake.headers["authorization"]?.split(" ")[1];
            
            if (!token && socket.handshake.headers.cookie) {
                const cookies = socket.handshake.headers.cookie.split(";");
                const accessTokenCookie = cookies.find(c => c.trim().startsWith(`${COOKIE_NAMES.ACCESS_TOKEN}=`));
                if (accessTokenCookie) {
                    token = accessTokenCookie.split("=")[1];
                }
            }

            if (!token) {
                return next(new Error("Authentication error: Token missing"));
            }
            try {
                const secret = process.env.JWT_SECRET || "super_secret_fallback_key";
                const decodedToken = jwt.verify(token, secret) as any;
                socket.data.user = decodedToken;
                next();
            } catch (err) {
                next(new Error("Authentication error: Invalid token"));
            }
        });

        io.on("connection", (socket) => {
            const userId = socket.data.user?.id;
            if (userId) {
                const userRoom = `user:${userId}`;
                socket.join(userRoom);
                logger.info(`User ${userId} connected and joined room: ${userRoom}`);
            }

            logger.info(`User connected to WebSockets: ${socket.id}`);

            const handleSubmissionSub = (submissionId: string) => {
                socket.join(submissionId);
                logger.info(`Socket ${socket.id} is listening for submission: ${submissionId}`);
            };
            socket.on("subscribeToSubmission", handleSubmissionSub);
            socket.on("subscribe_submission", handleSubmissionSub);

            socket.on("join_match", async (matchId: string) => {
                const match = await matchRepository.findOne({ where: { id: matchId } });
                if (!match || match.status !== MatchStatus.IN_PROGRESS) {
                    socket.emit("match_error", { message: "This match is no longer in progress." });
                    return;
                }
                const matchRoom = `match:${matchId}`;
                socket.join(matchRoom);
                logger.info(`Socket ${socket.id} joined match room: ${matchRoom}`);
                const roomSize = io.sockets.adapter.rooms.get(matchRoom)?.size || ZERO;
                const spectatorCount = Math.max(ZERO, roomSize - TWO);
                io.to(matchRoom).emit("spectator_count", spectatorCount);
            });

            socket.on("leave_match", (matchId: string) => {
                const matchRoom = `match:${matchId}`;
                socket.leave(matchRoom);
                logger.info(`Socket ${socket.id} left match room: ${matchRoom}`);
                const roomSize = io.sockets.adapter.rooms.get(matchRoom)?.size || ZERO;
                const spectatorCount = Math.max(ZERO, roomSize - TWO);
                io.to(matchRoom).emit("spectator_count", spectatorCount);
            });

            socket.on("match_code_update", (data: { matchId: string; code: string; language: string }) => {
                const uid = socket.data.user?.id;
                if (!uid || !data.matchId) return;
                socket.to(`match:${data.matchId}`).emit("spectator_code_update", {
                    userId: uid,
                    username: socket.data.user?.username,
                    code: data.code,
                    language: data.language
                });
            });

            socket.on("join_queue", async (data?: { tag?: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                
                const tag = data?.tag;
                
                await kafkaProducerClient.sendMessage(KafkaTopics.MATCHMAKING_REQUESTS, {
                    userId: uid,
                    tag
                });
                
                socket.emit(KafkaEvents.QUEUE_STATUS, { status: "waiting" });
                logger.info(`User ${uid} joined the queue${tag ? ` [${tag}]` : ""}.`);
            });

            socket.on("match_timeout", async (matchId: string) => {
                const uid = socket.data.user?.id;
                if (!uid || !matchId) return;

                await matchService.finishMatchByTimeout(matchId, uid);
            });

            socket.on("forfeit_match", async (matchId: string) => {
                const uid = socket.data.user?.id;
                if (!uid || !matchId) return;

                await matchService.finishMatchByTimeout(matchId, uid);
            });

            socket.on("propose_rematch", async (data: { matchId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid || !data.matchId) return;

                const match = await matchRepository.findOne({ where: { id: data.matchId }, relations: { user1: true, user2: true, problem: true } });
                if (!match) return;

                const opponentId = match.user1.id === uid ? match.user2.id : match.user1.id;
                const rematchKey = RedisKeys.getRematchKey(data.matchId);
                const existing = await redisCache.get(rematchKey);

                if (existing && existing !== uid) {
                    await redisCache.del(rematchKey);
                    
                    const tag = match.problem?.tags?.[ZERO] || "GENERIC";
                    await matchmakerService.createMatch(uid, opponentId, tag);
                } else {
                    await redisCache.set(rematchKey, uid, { EX: cacheExpirySeconds.ONE_MINUTE });
                    io.to(`user:${opponentId}`).emit("rematch_requested");
                }
            });

            socket.on("decline_rematch", async (data: { matchId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid || !data.matchId) return;
                const match = await matchRepository.findOne({ where: { id: data.matchId }, relations: { user1: true, user2: true } });
                if (!match) return;
                const opponentId = match.user1.id === uid ? match.user2.id : match.user1.id;
                const rematchKey = RedisKeys.getRematchKey(data.matchId);
                await redisCache.del(rematchKey);
                io.to(`user:${opponentId}`).emit("rematch_declined");
            });

            socket.on("custom_lobby_leave_match", async (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid || !data.lobbyId) return;

                const match = await customMatchRepository.getMatchById(data.lobbyId);
                if (match) {
                    const participant = match.participants?.find(p => p.user.id === uid);
                    if (participant) {
                        participant.status = CustomParticipantStatus.FORFEITED;
                        await customMatchParticipantRepository.saveEntity(participant);

                        io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_submission", {
                            lobbyId: data.lobbyId,
                            userId: uid,
                            username: participant.user.username,
                            status: "LEFT",
                            score: participant.score
                        });
                    }
                }
            });

            socket.on("leave_queue", async () => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                await matchmakerService.removeFromQueue(uid);
                socket.emit(KafkaEvents.QUEUE_STATUS, { status: "left" });
                logger.info(`User ${uid} left the queue.`);
            });

            socket.on("get_live_matches", () => {
                broadcastLiveMatches();
            });

            // Custom Lobbies
            socket.on("custom_lobby_create", async (data: { topic: string; timeLimit: number; maxParticipants: number; name?: string; difficulty?: string; isPublic?: boolean }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                
                const response = await customMatchService.createLobby(uid, data.topic, data.timeLimit, data.maxParticipants, data.name, data.difficulty, data.isPublic);
                if (response.responseCode < 400 && response.data) {
                    const lobbyId = response.data.id;
                    socket.join(`lobby:${lobbyId}`);
                    socket.emit("custom_lobby_updated", response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit("error", { message: response.data || "Failed to create lobby" });
                }
            });

            socket.on("custom_lobby_update", async (data: { lobbyId: string; topic: string; timeLimit: number; maxParticipants: number; isPublic?: boolean }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                const response = await customMatchService.updateLobby(data.lobbyId, uid, data);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_updated", response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit("error", { message: response.data || "Failed to update lobby" });
                }
            });

            socket.on("custom_lobby_invite", (data: { lobbyId: string; invitedUserId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                io.to(`user:${data.invitedUserId}`).emit("custom_lobby_invite_received", {
                    lobbyId: data.lobbyId,
                    inviterId: uid,
                    inviterUsername: socket.data.user.username
                });
            });

            socket.on("custom_lobby_join", async (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                
                const response = await customMatchService.joinLobby(data.lobbyId, uid);
                if (response.responseCode < 400 && response.data) {
                    socket.join(`lobby:${data.lobbyId}`);
                    io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_updated", response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit("error", { message: response.data || "Failed to join lobby" });
                }
            });

            socket.on("custom_lobby_join_by_code", async (data: { joinCode: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                const response = await customMatchService.joinLobbyByCode(data.joinCode, uid);
                if (response.responseCode < 400 && response.data) {
                    socket.join(`lobby:${response.data.id}`);
                    io.to(`lobby:${response.data.id}`).emit("custom_lobby_updated", response.data);
                    broadcastPublicLobbies();
                    socket.emit("custom_lobby_joined", response.data);
                } else {
                    socket.emit("error", { message: response.data || "Failed to join lobby" });
                }
            });

            socket.on("custom_lobby_decline", (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_declined", {
                    lobbyId: data.lobbyId,
                    declinerId: uid
                });
            });

            socket.on("custom_lobby_timeout", async (data: { lobbyId: string }) => {
                const match = await customMatchRepository.getMatchById(data.lobbyId);
                
                if (match && match.status !== MatchStatus.FINISHED) {
                    match.status = MatchStatus.FINISHED;
                    await customMatchRepository.saveEntity(match);
                }

                const leaderboard = (match?.participants || []).map(p => ({
                    userId: p.user.id,
                    username: p.user.username,
                    score: p.score || ZERO
                })).sort((a, b) => b.score - a.score);

                io.to(`lobby:${data.lobbyId}`).emit("custom_match_result", {
                    lobbyId: data.lobbyId,
                    result: "timeout",
                    leaderboard
                });
            });

            socket.on("custom_lobby_leave", async (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                socket.leave(`lobby:${data.lobbyId}`);
                const response = await customMatchService.leaveLobby(data.lobbyId, uid);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_updated", response.data);
                    broadcastPublicLobbies();
                    io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_left", { lobbyId: data.lobbyId, userId: uid });
                }
            });

            socket.on("custom_lobby_start", async (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                const response = await customMatchService.startMatch(data.lobbyId, uid);
                if (response.responseCode < 400 && response.data) {
                    io.to(`lobby:${data.lobbyId}`).emit("custom_match_started", response.data);
                    broadcastPublicLobbies();
                } else {
                    socket.emit("error", { message: response.data || "Failed to start match" });
                }
            });

            socket.on("custom_lobby_chat_message", async (data: { lobbyId: string; message: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                const user = await userRepository.getUserById(uid);
                if (!user) return;

                io.to(`lobby:${data.lobbyId}`).emit("custom_lobby_chat_message", {
                    userId: uid,
                    username: user.username,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
            });

            socket.on("custom_lobby_chat_typing", (data: { lobbyId: string; isTyping: boolean }) => {
                const uid = socket.data.user?.id;
                if (!uid || !data.lobbyId) return;

                socket.to(`lobby:${data.lobbyId}`).emit("custom_lobby_chat_typing", {
                    userId: uid,
                    username: socket.data.user?.username,
                    isTyping: data.isTyping
                });
            });

            // WebRTC Signaling
            socket.on("webrtc_offer", (data: { targetUserId: string; lobbyId: string; offer: RTCSessionDescriptionInit }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                io.to(`user:${data.targetUserId}`).emit("webrtc_offer", {
                    senderId: uid,
                    offer: data.offer
                });
            });

            socket.on("webrtc_answer", (data: { targetUserId: string; lobbyId: string; answer: RTCSessionDescriptionInit }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                io.to(`user:${data.targetUserId}`).emit("webrtc_answer", {
                    senderId: uid,
                    answer: data.answer
                });
            });

            socket.on("webrtc_ice_candidate", (data: { targetUserId: string; lobbyId: string; candidate: RTCIceCandidateInit }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;
                io.to(`user:${data.targetUserId}`).emit("webrtc_ice_candidate", {
                    senderId: uid,
                    candidate: data.candidate
                });
            });

            socket.on("custom_lobby_forfeit", async (data: { lobbyId: string }) => {
                const uid = socket.data.user?.id;
                if (!uid) return;

                await customMatchService.forfeitMatch(data.lobbyId, uid);
                io.to(`user:${uid}`).emit("custom_match_result", { lobbyId: data.lobbyId, result: "FORFEIT" });
            });

            socket.on("disconnecting", () => {
                for (const room of socket.rooms) {
                    if (room.startsWith("match:")) {
                        const roomSize = io.sockets.adapter.rooms.get(room)?.size || 1;
                        const spectatorCount = Math.max(ZERO, roomSize - 1 - TWO);
                        io.to(room).emit("spectator_count", spectatorCount);
                    }
                }
            });
        });

        // The Bridge: Listen to our internal Event Emitter
        appEvents.on(KafkaEvents.SUBMISSION_GRADED, (resultData) => {
            logger.info(`🚀 Event with Submission ID: ${resultData.submissionId} fired`);
            io.to(resultData.submissionId).emit("evaluation_complete", resultData);
        });

        appEvents.on(KafkaEvents.CUSTOM_SUBMISSION_GRADED, (resultData) => {
            io.to(`lobby:${resultData.lobbyId}`).emit("custom_lobby_submission", resultData);
        });

        appEvents.on(KafkaEvents.QUEUE_STATUS, (data) => {
            io.to(`user:${data.userId}`).emit(KafkaEvents.QUEUE_STATUS, data);
        });

        appEvents.on(KafkaEvents.MATCH_FOUND, (data) => {
            logger.info(`[WS] Emitting match_found to user:${data.user1Id} and user:${data.user2Id}`);
            io.to(`user:${data.user1Id}`).emit(KafkaEvents.MATCH_FOUND, data);
            io.to(`user:${data.user2Id}`).emit(KafkaEvents.MATCH_FOUND, data);
            broadcastLiveMatches();
        });

        appEvents.on(KafkaEvents.OPPONENT_STATUS, (data) => {
            io.to(`match:${data.matchId}`).emit(KafkaEvents.OPPONENT_STATUS, data);
        });

        appEvents.on(KafkaEvents.MATCH_RESULT, (data) => {
            io.to(`match:${data.matchId}`).emit(KafkaEvents.MATCH_RESULT, data);
            broadcastLiveMatches();
        });

        appEvents.on(KafkaEvents.ELO_UPDATE, (data) => {
            io.to(`user:${data.userId}`).emit(KafkaEvents.ELO_UPDATE, data);
        });

        server.listen(PORT, "0.0.0.0", () => {
            logger.info(`🚀 Server is running on http://localhost:${PORT}...`);
        });

    } catch (error: unknown) {
        ErrorLoggingUtils.logError(error, "ServerBootstrap", "startServer");
        handleShutdown("STARTUP_FAILURE");
    }
}

startServer();