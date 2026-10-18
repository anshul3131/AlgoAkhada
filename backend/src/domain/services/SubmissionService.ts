/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for code submission lifecycle, Kafka event publishing, and submission querying
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { Submission } from "../entities/Submission";
import { submissionRepository, SubmissionRepository } from "../../infrastructure/database/repositories/SubmissionRepository";
import { userRepository, UserRepository } from "../../infrastructure/database/repositories/UserRepository";
import { problemRepository, ProblemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { Language } from "../enums/CodeLanguage";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { RESPONSE_CODES, RESPONSE_MESSAGES, ResponseData } from "../classes/ResponseDTO";
import { SubmissionDTO } from "../classes/SubmissionDTO";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, EMPTY_STRING } from "../../constants/AppConstant";

@Service()
export class SubmissionService {
    private submissionRepository: SubmissionRepository;
    private userRepository: UserRepository;
    private problemRepository: ProblemRepository;

    constructor() {
        this.submissionRepository = submissionRepository;
        this.userRepository = userRepository;
        this.problemRepository = problemRepository;
    }

    public async createSubmission(
        userId: string, 
        problemId: string, 
        language: Language, 
        code: string, 
        mode: 'match' | 'upsolve' | 'custom' = 'match', 
        matchId?: string
    ): Promise<Submission> {
        const user = await this.userRepository.getUserById(userId);
        if (!user) throw new Error("USER_NOT_FOUND");

        const problem = await this.problemRepository.getProblemById(problemId);
        if (!problem) throw new Error("PROBLEM_NOT_FOUND");

        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const submissionData = this.submissionRepository.create({
                user,
                problem,
                language,
                code
            });
            const savedSubmission = await this.submissionRepository.saveEntity(submissionData, queryRunner);

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
            await queryRunner.commitTransaction();

            return savedSubmission;
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            ErrorLoggingUtils.logError(error, 'SubmissionService', 'createSubmission', { userId, problemId, mode });
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    public async getUserSubmissionMetadata(userId: string): Promise<ResponseData> {
        try {
            const data = await this.submissionRepository.getUserSubmissionMetadata(userId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'SubmissionService', 'getUserSubmissionMetadata', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getUserSubmissions(
        userId: string,
        page: number,
        limit: number,
        status?: string,
        topic?: string,
        search?: string
    ): Promise<ResponseData> {
        try {
            const pageNum = page ? Number(page) : DEFAULT_PAGE;
            const limitNum = limit ? Number(limit) : DEFAULT_PAGE_LIMIT;

            const { submissions, total } = await this.submissionRepository.getUserSubmissions(
                userId,
                pageNum,
                limitNum,
                status,
                topic,
                search
            );

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

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { items, total, page: pageNum, limit: limitNum });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'SubmissionService', 'getUserSubmissions', { userId, page, limit, status, topic, search });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getSubmissionById(submissionId: string): Promise<ResponseData> {
        try {
            if (!submissionId) {
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
            }

            const submission = await this.submissionRepository.findOne({
                where: { id: submissionId },
                relations: { problem: true }
            });

            if (!submission) {
                return ResponseData.build(RESPONSE_CODES.NOT_AVAILABLE, RESPONSE_MESSAGES.NOT_FOUND);
            }

            const data: SubmissionDTO = {
                submissionId: submission.id,
                problemId: submission.problem ? submission.problem.id : EMPTY_STRING,
                problemTitle: submission.problem ? submission.problem.title : EMPTY_STRING,
                language: submission.language,
                code: submission.code,
                status: submission.status
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'SubmissionService', 'getSubmissionById', { submissionId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const submissionService = Container.get(SubmissionService);