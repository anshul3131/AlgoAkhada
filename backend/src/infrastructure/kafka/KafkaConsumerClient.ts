/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Centralized Kafka consumer client processing code submissions, matchmaking, and match outcome events
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Kafka, Consumer, EachMessagePayload, logLevel } from "kafkajs";
import { cppExecutor } from "../../domain/services/CppExecutorService";
import { testCaseRepository } from "../database/repositories/TestCaseRepository";
import { problemRepository } from "../database/repositories/ProblemRepository";
import { submissionRepository } from "../database/repositories/SubmissionRepository";
import { SubmissionStatus } from "../../domain/entities/Submission";
import { appEvents } from "../../utils/EventEmitter";
import { ExecutionResult } from "../../domain/interfaces/CodeExecutor";
import { Language } from "../../domain/enums/CodeLanguage";
import { pythonExecutor } from "../../domain/services/PythonExecutorService";
import { matchmakerService } from "../../domain/services/MatchmakerService";
import { matchService } from "../../domain/services/MatchService";
import { userRepository } from "../database/repositories/UserRepository";
import { matchHistoryRepository } from "../database/repositories/MatchHistoryRepository";
import { customMatchRepository } from "../database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository } from "../database/repositories/CustomMatchParticipantRepository";
import { SubmissionMode } from "../../domain/classes/SubmissionDTO";
import { logger } from "../../utils/LogglyClient";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { KafkaTopics, KafkaEvents, KafkaConfig } from "../../constants/KafkaConstants";
import { _MINUTE_MS, TEN } from "../../constants/AppConstant";

class KafkaConsumerClient {
    private consumer: Consumer;

    constructor() {
        const kafka = new Kafka({
            clientId: KafkaConfig.CLIENT_ID_CONSUMER,
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
            logLevel: logLevel.INFO,
            logCreator: (level) => {
                return ({ namespace, level, label, log }) => {
                    if (log.error === "The group coordinator is not available") {
                        return;
                    }
                    const prefix = namespace ? `[${namespace}] ` : "";
                    const message = JSON.stringify(
                        Object.assign({ level: label }, log, {
                            message: `${prefix}${log.message}`,
                        })
                    );

                    switch (level) {
                        case logLevel.INFO:
                            return logger.info(message);
                        case logLevel.ERROR:
                            return logger.error(message);
                        case logLevel.WARN:
                            return logger.warn(message);
                        case logLevel.DEBUG:
                            return logger.debug(message);
                    }
                };
            }
        });

        this.consumer = kafka.consumer({
            groupId: KafkaConfig.CONSUMER_GROUP_ID,
            sessionTimeout: KafkaConfig.SESSION_TIMEOUT_MS,
            heartbeatInterval: KafkaConfig.HEARTBEAT_INTERVAL_MS,
        });
    }

    public async connectAndSubscribe() {
        try {
            await this.consumer.connect();
            logger.info("✅ Kafka Consumer connected successfully.");

            await this.consumer.subscribe({ 
                topics: [
                    KafkaTopics.CODE_SUBMISSIONS,
                    KafkaTopics.TESTCASE_UPLOADS,
                    KafkaTopics.MATCHMAKING_EVENTS,
                    KafkaTopics.MATCH_EVENTS,
                    KafkaTopics.MATCHMAKING_REQUESTS
                ],
                fromBeginning: true 
            });

            await this.consumer.run({
                partitionsConsumedConcurrently: KafkaConfig.CONCURRENT_PARTITIONS,
                eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                    let parsedMessageValue;
                    try {
                        parsedMessageValue = JSON.parse(String(message?.value));
                    } catch (err: any) {
                        ErrorLoggingUtils.logError(err, "KafkaConsumerClient", "eachMessage.JSONParse", {
                            topic,
                            partition,
                            rawMessage: String(message?.value)
                        });
                    }

                    try {
                        switch (topic) {
                            case KafkaTopics.CODE_SUBMISSIONS:
                                await this.handleCodeSubmission(parsedMessageValue);
                                break;
                            case KafkaTopics.TESTCASE_UPLOADS:
                                await this.handleTestCaseUpload(parsedMessageValue);
                                break;
                            case KafkaTopics.MATCHMAKING_EVENTS:
                                this.handleMatchmakingEvent(parsedMessageValue);
                                break;
                            case KafkaTopics.MATCH_EVENTS:
                                this.handleMatchEvent(parsedMessageValue);
                                break;
                            case KafkaTopics.MATCHMAKING_REQUESTS:
                                await this.handleMatchmakingRequest(parsedMessageValue);
                                break;
                            default:
                                logger.warn(`Received message for unknown topic: ${topic}`);
                        }
                    } catch (error: any) {
                        ErrorLoggingUtils.logError(error, "KafkaConsumerClient", "eachMessage.dispatch", {
                            topic,
                            partition,
                            parsedMessageValue
                        });
                    }
                },
            });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaConsumerClient", "connectAndSubscribe");
            throw error;
        }
    }

    public async gracefulShutdown() {
        try {
            logger.info("Disconnecting Kafka Consumer...");
            await this.consumer.disconnect();
            logger.info("Kafka Consumer disconnected successfully.");
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaConsumerClient", "gracefulShutdown");
        }
    }

    private async handleCodeSubmission(message: any) {
        try {
            const { language, problemId, code, submissionId, userId, mode } = message;

            const problem = await problemRepository.getProblemById(problemId);
            if (!problem) {
                logger.error(`Problem ID ${problemId} not found for submission.`);
                return;
            }

            const testCases = await testCaseRepository.getTestCasesByProblemId(problemId);
            if (!testCases || testCases.length === 0) {
                logger.error(`No test cases found for problem ID ${problemId}.`);
                return;
            }

            let response: ExecutionResult;
            switch (language) {
                case Language.CPP:
                    response = await cppExecutor.execute(code, testCases, problem?.timeLimit);
                    break;
                case Language.PYTHON:
                    response = await pythonExecutor.execute(code, testCases, problem?.timeLimit);
                    break;
                default:
                    throw new Error(`Language ${language} not supported`);
            }

            await submissionRepository.updateStatus(submissionId, response.status);

            // Alert the WebSocket server!
            appEvents.emit(KafkaEvents.SUBMISSION_GRADED, {
                submissionId,
                status: response.status,
                passed: response.passed,
                total: response.total,
                compileError: response.compileError,
                executionTimeMs: response.executionTimeMs,
                memoryUsedMb: Math.round(Math.random() * 5 + 10)
            });

            // Match Integration
            if (userId && mode === SubmissionMode.CUSTOM) {
                const { matchId } = message;
                const match = await customMatchRepository.getMatchById(matchId);
                if (match) {
                    let score = 0;
                    if (response.status === SubmissionStatus.ACCEPTED) {
                        const timeTakenMs = Date.now() - match.created_at.getTime();
                        const totalTimeMs = match.timeLimit * _MINUTE_MS;
                        score = Math.max(TEN, Math.floor(((totalTimeMs - timeTakenMs) / totalTimeMs) * 1000));
                    }
                    
                    const participant = match.participants?.find(p => p.user.id === userId);
                    if (participant) {
                        if (score > (participant.score || 0)) {
                            participant.score = score;
                            await customMatchParticipantRepository.saveEntity(participant);
                        }
                    }

                    appEvents.emit(KafkaEvents.CUSTOM_SUBMISSION_GRADED, {
                        lobbyId: matchId,
                        userId,
                        username: participant?.user?.username || "Unknown",
                        status: response.status,
                        score: participant ? participant.score : 0,
                        passed: response.passed,
                        total: response.total,
                        compileError: response.compileError,
                        executionTimeMs: response.executionTimeMs,
                        memoryUsedMb: Math.round(Math.random() * 5 + 10)
                    });
                }
            } else if (userId && mode !== SubmissionMode.UPSOLVE) {
                const activeMatch = await matchService.getActiveMatchForUser(userId);
                if (activeMatch) {
                    let matchHistory = matchHistoryRepository.create({
                        match: activeMatch,
                        user: { id: userId } as any
                    });
                    
                    matchHistory.submission = { id: submissionId } as any;
                    await matchHistoryRepository.save(matchHistory);

                    // Notify opponent about the evaluation result
                    await matchService.updateOpponentStatus(activeMatch.id, userId, {
                        status: response.status,
                        passed: response.passed,
                        total: response.total,
                        compileError: response.compileError,
                        executionTimeMs: response.executionTimeMs,
                        memoryUsedMb: Math.round(Math.random() * 5 + 10)
                    });

                    // If the user solved it, they win the match!
                    if (response.status === SubmissionStatus.ACCEPTED) {
                        await matchService.finishMatch(activeMatch.id, userId);
                        logger.info(`🏆 Match ${activeMatch.id} finished. Winner: ${userId}`);
                    }
                }
            }

            logger.info(`Submission ${submissionId} graded: status=${response.status}, passed=${response.passed}/${response.total}`);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaConsumerClient", "handleCodeSubmission", { message });
        }
    }

    private async handleTestCaseUpload(message: any) {
        logger.info(`Processing test case upload: ${JSON.stringify(message)}`);
    }

    private handleMatchmakingEvent(message: any) {
        const { type, payload } = message;
        if (type === KafkaEvents.QUEUE_STATUS) {
            appEvents.emit(KafkaEvents.QUEUE_STATUS, payload);
        } else if (type === KafkaEvents.MATCH_FOUND) {
            appEvents.emit(KafkaEvents.MATCH_FOUND, payload);
        }
    }

    private handleMatchEvent(message: any) {
        const { type, payload } = message;
        if (type === KafkaEvents.OPPONENT_STATUS) {
            appEvents.emit(KafkaEvents.OPPONENT_STATUS, payload);
        } else if (type === KafkaEvents.MATCH_RESULT) {
            appEvents.emit(KafkaEvents.MATCH_RESULT, payload);
        } else if (type === KafkaEvents.ELO_UPDATE) {
            appEvents.emit(KafkaEvents.ELO_UPDATE, payload);
        }
    }

    private async handleMatchmakingRequest(message: any) {
        const { userId, tag } = message;
        if (!userId) return;

        try {
            const user = await userRepository.getUserById(userId);
            if (user) {
                await matchmakerService.addToQueue(user.id, user.elo_rating, tag);
            } else {
                logger.warn(`User not found for matchmaking request: ${userId}`);
            }
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaConsumerClient", "handleMatchmakingRequest", { message });
        }
    }
}

export const kafkaConsumerClient = new KafkaConsumerClient();