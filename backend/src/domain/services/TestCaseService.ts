/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for queuing asynchronous test case batch upload jobs to Kafka
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { problemRepository, ProblemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";

@Service()
export class TestCaseService {
    private problemRepository: ProblemRepository;

    constructor() {
        this.problemRepository = problemRepository;
    }
    
    public async queueTestCaseBatchUpload(problemId: string, fileUrl: string): Promise<void> {
        try {
            const problem = await this.problemRepository.getProblemById(problemId);
            if (!problem) {
                throw new Error("PROBLEM_NOT_FOUND");
            }

            const kafkaPayload = { 
                problemId: problem.id, 
                fileUrl 
            };
            
            await kafkaProducerClient.sendMessage("testcase-uploads", kafkaPayload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'TestCaseService', 'queueTestCaseBatchUpload', { problemId, fileUrl });
            throw error;
        }
    }
}

export const testCaseService = Container.get(TestCaseService);