import { Kafka, Consumer, EachMessagePayload, Message } from "kafkajs";
import { cppExecutor } from "../../domain/services/CppExecutorService";
import {testCaseRepository} from "../../infrastructure/database/repositories/TestCaseRepository";
import { problemRepository } from "../database/repositories/ProblemRepository";
import { submissionRepository } from "../database/repositories/SubmissionRepository";
import { SubmissionService } from "../../domain/services/SubmissionService";
import { SubmissionStatus } from "../../domain/entities/Submission";
class KafkaConsumerClient {
    private consumer: Consumer;

    constructor() {
        const kafka = new Kafka({
            clientId: "cp-arena-consumer",
            brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
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
                topics: ["code-submissions","testcase-uploads"] ,
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
            const { problemId, code, submissionId } = message;

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

            const response = await cppExecutor.execute(code, testCases, problem?.timeLimit);

            await submissionRepository.updateStatus(submissionId, response.status);
            console.log(`Submission ${submissionId} evaluated:`, response.status);
            console.log(`Total Number of testCases Passed : ${response.passed}`);
            if(response.status==SubmissionStatus.WRONG_ANSWER)
            {
                console.log(`Failed TestCase : ${response.failedTestCase}`);
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
}

export const kafkaConsumerClient = new KafkaConsumerClient();