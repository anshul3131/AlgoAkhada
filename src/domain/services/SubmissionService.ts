import { Submission } from "../entities/Submission";
import { submissionRepository } from "../../infrastructure/database/repositories/SubmissionRepository";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";

export class SubmissionService {
    async createSubmission(userId: string, problemId: string, language: string, code: string): Promise<Submission> {
        // 1. Validate relations exist in the database
        const user = await userRepository.getUserById(userId);
        if (!user) throw new Error("USER_NOT_FOUND");

        const problem = await problemRepository.getProblemById(problemId);
        if (!problem) throw new Error("PROBLEM_NOT_FOUND");

        // 2. Create the PENDING submission in Postgres
        const submissionData = submissionRepository.create({
            user,
            problem,
            language,
            code
            // status automatically defaults to PENDING via the TypeORM entity
        });
        const savedSubmission = await submissionRepository.saveEntity(submissionData);

        // 3. Publish the event to Kafka for the background workers to consume
        const kafkaPayload = { 
            submissionId: savedSubmission.id, 
            language, 
            code, 
            problemId: problem.id 
        };
        
        await kafkaProducerClient.sendMessage("code-submissions", kafkaPayload);

        return savedSubmission;
    }
}

export const submissionService = new SubmissionService();