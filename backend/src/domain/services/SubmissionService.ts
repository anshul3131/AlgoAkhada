import { Submission } from "../entities/Submission";
import { submissionRepository } from "../../infrastructure/database/repositories/SubmissionRepository";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { Language } from "../enums/CodeLanguage";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { RESPONSE_CODES, RESPONSE_MESSAGES, ResponseData } from "../classes/ResponseDTO";
import { SubmissionDTO } from "../classes/SubmissionDTO";

export class SubmissionService {
    async createSubmission(userId: string, problemId: string, language: Language, code: string, mode: 'match' | 'upsolve' | 'custom' = 'match', matchId?: string): Promise<Submission> {
        // 1. Validate relations exist in the database
        const user = await userRepository.getUserById(userId);
        if (!user) throw new Error("USER_NOT_FOUND");

        const problem = await problemRepository.getProblemById(problemId);
        if (!problem) throw new Error("PROBLEM_NOT_FOUND");

        // 2. Start a Database Transaction
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Create the PENDING submission in Postgres
            const submissionData = submissionRepository.create({
                user,
                problem,
                language,
                code
                // status automatically defaults to PENDING via the TypeORM entity
            });
            const savedSubmission = await submissionRepository.saveEntity(submissionData, queryRunner);

            // 3. Publish the event to Kafka for the background workers to consume
            const kafkaPayload = { 
                submissionId: savedSubmission.id, 
                language, 
                code, 
                problemId: problem.id,
                userId: user.id,
                mode,
                matchId
            };
            
            await kafkaProducerClient.sendMessage("code-submissions", kafkaPayload);

            // Commit the transaction
            await queryRunner.commitTransaction();

            return savedSubmission;
        } catch (error) {
            // If anything fails (e.g. Kafka down), rollback the database transaction
            await queryRunner.rollbackTransaction();
            console.error("❌ Submission transaction failed. Rolling back...", error);
            throw error;
        } finally {
            // Release the connection back to the pool
            await queryRunner.release();
        }
    }


    async getUserSubmissions(userId: string, page: number, limit: number, status?: string, topic?: string): Promise<ResponseData> {
        try {
            page = page ? Number(page) : 1;
            limit = limit ? Number(limit) : 20;

            const subRepo = AppDataSource.getRepository(Submission);
            const query = subRepo.createQueryBuilder("submission")
                .leftJoinAndSelect("submission.problem", "problem")
                .where("submission.user.id = :userId", { userId })
                .orderBy("submission.submittedAt", "DESC")
                .skip((page - 1) * limit)
                .take(limit);

            if (status) {
                query.andWhere("submission.status = :status", { status });
            }

            if (topic) {
                query.andWhere("problem.tags LIKE :topic", { topic: `%${topic}%` });
            }

            const [submissions, total] = await query.getManyAndCount();

            const items = submissions.map(s => ({
                id: s.id,
                status: s.status,
                language: s.language,
                executionTimeMs: s.executionTimeMs,
                memoryUsedMb: s.memoryUsedMb,
                submittedAt: s.submittedAt,
                problem: s.problem ? {
                    id: s.problem.id,
                    title: s.problem.title,
                    difficulty: s.problem.difficulty,
                    tags: s.problem.tags,
                    timeLimit: s.problem.timeLimit,
                    memoryLimit: s.problem.memoryLimit
                } : null
            }));

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { items, total, page, limit });
        } catch (error: any) {
            console.error(`[SubmissionService] getUserSubmissions error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    async getSubmissionById(submissionId: string): Promise<ResponseData> {
        try {
            if (!submissionId) {
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
            }

            const submission = await submissionRepository.findOne({
                where: { id: submissionId },
                relations: {problem : true}
            });

            if (!submission) {
                return ResponseData.build(RESPONSE_CODES.NOT_AVAILABLE, RESPONSE_MESSAGES.NOT_FOUND);
            }

            const data: SubmissionDTO = {
                submissionId: submission.id,
                problemId: submission.problem ? submission.problem.id : "",
                problemTitle: submission.problem ? submission.problem.title : "",
                language: submission.language,
                code: submission.code,
                status: submission.status
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[SubmissionService] getSubmissionById error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const submissionService = new SubmissionService();