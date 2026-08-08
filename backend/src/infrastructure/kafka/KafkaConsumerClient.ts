import { Kafka, Consumer, EachMessagePayload, Message, logLevel } from "kafkajs";
import { cppExecutor } from "../../domain/services/CppExecutorService";
import {testCaseRepository} from "../database/repositories/TestCaseRepository";
import { problemRepository } from "../database/repositories/ProblemRepository";
import { submissionRepository } from "../database/repositories/SubmissionRepository";
import { SubmissionStatus } from "../../domain/entities/Submission";
import { appEvents } from "../../utils/EventEmitter"; // Import the global bridge
import { ExecutionResult } from "../../domain/interfaces/CodeExecutor";
import { Language } from "../../domain/enums/CodeLanguage";
import { pythonExecutor } from "../../domain/services/PythonExecutorService";
import { matchmakerService } from "../../domain/services/MatchmakerService";
import { AppDataSource } from "../database/data_source";
import { User } from "../../domain/entities/User";
import { matchService } from "../../domain/services/MatchService";
import { userRepository } from "../database/repositories/UserRepository";
import { matchHistoryRepository } from "../database/repositories/MatchHistoryRepository";

class KafkaConsumerClient {
    private consumer: Consumer;

    constructor() {
        const kafka = new Kafka({
            clientId: "cp-arena-consumer",
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
            logLevel: logLevel.INFO,
            logCreator: (level) => {
                return ({ namespace, level, label, log }) => {
                    if (log.error === "The group coordinator is not available") {
                        return; // Suppress this specific noisy error
                    }
                    const prefix = namespace ? `[${namespace}] ` : '';
                    const message = JSON.stringify(
                        Object.assign({ level: label }, log, {
                            message: `${prefix}${log.message}`,
                        })
                    );

                    switch (level) {
                        case logLevel.INFO:
                            return console.info(message);
                        case logLevel.ERROR:
                            return console.error(message);
                        case logLevel.WARN:
                            return console.warn(message);
                        case logLevel.DEBUG:
                            return console.log(message);
                    }
                };
            }
        });

        this.consumer = kafka.consumer({
            groupId: 'cp-arena-consumer', // Keep whatever your group ID is

            // 1. Increase session timeout to 2 minutes (120,000 ms). 
            sessionTimeout: 120000,

            // 2. Adjust the heartbeat interval so it pings Kafka more reliably 
            // to let it know the worker is still alive.
            heartbeatInterval: 10000,
        });
    }

    public async connectAndSubscribe() {
        try {
            await this.consumer.connect();
            console.log("✅ Kafka Consumer connected successfully.");

            // Subscribe to our topic. 
            // fromBeginning: true means if the worker crashes and misses messages, 
            // it will read the backlog when it boots back up.
            await this.consumer.subscribe({ 
                topics: ["code-submissions", "testcase-uploads", "matchmaking-events", "match-events", "matchmaking-requests"],
                fromBeginning: true 
            });

            // Start the infinite listening loop
            await this.consumer.run({
                partitionsConsumedConcurrently: 6,
                eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                    let parsedMessageValue;
                    try {
                        parsedMessageValue = JSON.parse(String(message?.value));
                    } catch (err: any) {
                        console.error(`Error parsing kafka message : ${message}, error :: ${err.message}`);
                    }
                    try {
                        switch (topic) {
                            case "code-submissions":
                                await this.handleCodeSubmission(parsedMessageValue);
                                break;
                            case "testcase-uploads":
                                await this.handleTestCaseUpload(parsedMessageValue);
                                break;
                            case "matchmaking-events":
                                this.handleMatchmakingEvent(parsedMessageValue);
                                break;
                            case "match-events":
                                this.handleMatchEvent(parsedMessageValue);
                                break;
                            case "matchmaking-requests":
                                await this.handleMatchmakingRequest(parsedMessageValue);
                                break;
                            default:
                                console.warn(`⚠️ Received message for unknown topic: ${topic}`);
                        }
                    } catch (error) {
                        console.error(`❌ Unrecoverable error processing topic ${topic}:`, error);
                        // TODO: Send this broken message to a Dead Letter Queue (DLQ) 
                        // so you can investigate it later without losing the user's submission.
                    }
                },
            });
        } catch (error) {
            console.error("❌ Fatal error in Kafka Consumer:", error);
            throw error;
        }
    }

    public async gracefulShutdown() {
        try {
            console.log("🛑 Disconnecting Kafka Consumer...");
            await this.consumer.disconnect();
            console.log("✅ Kafka Consumer disconnected.");
        } catch (error) {
            console.error("❌ Error disconnecting Kafka Consumer:", error);
        }
    }

    private async handleCodeSubmission(message: any) {
        try {
            const {language,problemId, code, submissionId,userId} = message;

            const problem = await problemRepository.getProblemById(problemId);
            if (!problem) {
                console.error(`Problem ID ${problemId} not found for submission.`);
                return; // Or update database to mark submission as "Failed: Invalid Problem"
            }

            const testCases = await testCaseRepository.getTestCasesByProblemId(problemId);
            if (!testCases || testCases.length === 0) {
                console.error(`No test cases found for problem ID ${problemId}.`);
                return;
            }

            let response : ExecutionResult;
            // console.log(language)
            switch(language){
                case Language.CPP:
                    response = await cppExecutor.execute(code, testCases, problem?.timeLimit);
                    break;
                case Language.PYTHON:
                    response = await pythonExecutor.execute(code, testCases, problem?.timeLimit);
                    break;
                default:
                    throw new Error(`${language} not supported`)
            }

            await submissionRepository.updateStatus(submissionId, response.status);

            //Alert the WebSocket server!
            appEvents.emit('submission_graded', {
                submissionId: submissionId,
                status: response.status,
                passed: response.passed,
                total: response.total
            });

            // === Match Integration ===                                                        
                if (userId) {                                                                       
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
                            total: response.total
                        });
    
                        // If the user solved it, they win the match!
                        if (response.status === SubmissionStatus.ACCEPTED) {
                            await matchService.finishMatch(activeMatch.id, userId);
                            console.log(`🏆 Match ${activeMatch.id} finished. Winner: ${userId}`);  
                        }
                    }
                }

            switch(response.status){
                case SubmissionStatus.WRONG_ANSWER:
                    console.log(`❌Wrong Answer, TestCase ${response.passed+1} failed : ${response.failedTestCase}`);
                    break;
                case SubmissionStatus.ACCEPTED:
                    console.log(`✅Accepted, Total Number of TestCases Passed : ${response.passed}`)
                    break;
                default:
                    break;
            }
            
        }
        catch (error) {
            console.error("❌ Error processing code submission:", error);
        }
    }

    private async handleTestCaseUpload(message: any) {
        // Placeholder for actual test case upload processing logic
        console.log("🔧 Processing test case upload:", message?.toString());
        // Here you would typically parse the message, validate it, and then process the test case file.
    }

    private handleMatchmakingEvent(message: any) {
        const { type, payload } = message;
        // type could be 'queue_status', 'match_found'
        if (type === 'queue_status') {
            appEvents.emit('queue_status', payload);
        } else if (type === 'match_found') {
            appEvents.emit('match_found', payload);
        }
    }

    private handleMatchEvent(message: any) {
        const { type, payload } = message;
        // type could be 'opponent_status', 'match_result', 'elo_update'
        if (type === 'opponent_status') {
            appEvents.emit('opponent_status', payload);
        } else if (type === 'match_result') {
            appEvents.emit('match_result', payload);
        } else if (type === 'elo_update') {
            appEvents.emit('elo_update', payload);
        }
    }

    private async handleMatchmakingRequest(message: any) {
        const { userId } = message;
        if (!userId) return;

        try {
            const user = await userRepository.getUserById(userId);
            if (user) {
                await matchmakerService.addToQueue(user.id, user.elo_rating);
            } else {
                console.warn(`⚠️ User not found for matchmaking request: ${userId}`);
            }
        } catch (error) {
            console.error("❌ Error processing matchmaking request:", error);
        }
    }
}

export const kafkaConsumerClient = new KafkaConsumerClient();