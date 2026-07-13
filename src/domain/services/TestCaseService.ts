import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";

export class TestCaseService {
    
    async queueTestCaseBatchUpload(problemId: string, fileUrl: string): Promise<void> {
        // 1. Verify the problem actually exists before queuing
        const problem = await problemRepository.getProblemById(problemId);
        if (!problem) {
            throw new Error("PROBLEM_NOT_FOUND");
        }

        // 2. Push the async processing job to Kafka
        const kafkaPayload = { 
            problemId: problem.id, 
            fileUrl 
        };
        
        // We use a dedicated topic for this specific heavy workload
        await kafkaProducerClient.sendMessage("testcase-uploads", kafkaPayload);
    }
}

export const testCaseService = new TestCaseService();