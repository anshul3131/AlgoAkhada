/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for problem management, tag exploration, detail resolution, and bulk ingestion
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { Submission, SubmissionStatus } from "../entities/Submission";
import { Problem, ProblemDifficulty } from "../entities/Problem";
import { ProblemRepository, problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { SubmissionRepository, submissionRepository } from "../../infrastructure/database/repositories/SubmissionRepository";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { TestCase } from "../entities/TestCase";
import { ProblemTag } from "../enums/ProblemTag";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { ProblemDetailDTO, ProblemSampleDTO, TagsResponseDTO } from "../classes/ProblemDTO";
import { ProblemFormatter } from "../../utils/ProblemFormatter";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";
import { cacheExpirySeconds } from "../../constants/CacheConstants";
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from "../../constants/AppConstant";

const DEFAULT_TIME_LIMIT_SEC = 2;
const DEFAULT_MEMORY_LIMIT_MB = 256;

@Service()
export class ProblemService {
    private problemRepository: ProblemRepository;
    private submissionRepository: SubmissionRepository;

    constructor() {
        this.problemRepository = problemRepository;
        this.submissionRepository = submissionRepository;
    }
    
    public async createProblem(title: string, description: string, difficulty?: ProblemDifficulty, timeLimit?: number, memoryLimit?: number): Promise<ResponseData> {
        try {
            const problemData = new Problem();
            problemData.title = title;
            problemData.description = description;
            problemData.difficulty = difficulty || ProblemDifficulty.MEDIUM; 
            problemData.timeLimit = timeLimit || DEFAULT_TIME_LIMIT_SEC;
            problemData.memoryLimit = memoryLimit || DEFAULT_MEMORY_LIMIT_MB;
            
            const saved = await this.problemRepository.saveEntity(problemData);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, saved);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'ProblemService', 'createProblem', { title });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getTags(): Promise<ResponseData> {
        try {
            const cacheKey = RedisKeys.getProblemTagsKey();
            try {
                const cached = await redisCache.get<TagsResponseDTO>(cacheKey);
                if (cached) {
                    return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, cached);
                }
            } catch (cacheErr: any) {
                logger.warn(`[ProblemService] Redis get tags failed: ${cacheErr.message}`);
            }

            const data: TagsResponseDTO = { tags: Object.values(ProblemTag) };

            try {
                await redisCache.set(cacheKey, data, { EX: cacheExpirySeconds.ONE_HOUR });
            } catch (cacheErr: any) {
                logger.warn(`[ProblemService] Redis set tags failed: ${cacheErr.message}`);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'ProblemService', 'getTags');
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getAllProblems(page: number, limit: number, difficulty: string, search: string, tag: string, userId?: string): Promise<ResponseData> {
        try {
            const pageNum = page ? Number(page) : DEFAULT_PAGE;
            const limitNum = limit ? Number(limit) : DEFAULT_PAGE_LIMIT;

            const result = await this.problemRepository.getAllProblems(pageNum, limitNum, difficulty, search, tag);
            
            let solvedProblemIds = new Set<string>();
            if (userId) {
                const subRepo = AppDataSource.getRepository(Submission);
                const solvedSubs = await subRepo.find({
                    where: { user: { id: userId }, status: SubmissionStatus.ACCEPTED },
                    relations: { problem: true }
                });
                solvedProblemIds = new Set(solvedSubs.map(s => s.problem.id));
            }

            const responsePayload: any = {
                items: result.problems.map(p => ({
                    id: p.id,
                    title: p.title,
                    difficulty: p.difficulty,
                    tags: p.tags || [],
                    timeLimit: p.timeLimit,
                    memoryLimit: p.memoryLimit,
                    isSolved: solvedProblemIds.has(p.id)
                })),
                page: result.page,
                limit: result.limit,
                total: result.total
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, responsePayload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'ProblemService', 'getAllProblems', { page, limit, difficulty, search, tag });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getProblemDetails(id: string, userId?: string): Promise<ResponseData> {
        try {
            const problem = await this.problemRepository.getProblemById(id);
            if (!problem) {
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND);
            }

            const samples: ProblemSampleDTO[] = (problem.testCases || [])
                .filter(tc => !tc.isHidden)
                .map(tc => ({
                    id: tc.id,
                    name: tc.name || "Example",
                    input: tc.input,
                    output: tc.expectedOutput,
                    explanation: tc.explanation || ""
                }));

            const payload: ProblemDetailDTO = {
                id: problem.id,
                title: problem.title,
                description: ProblemFormatter.formatCodeforces(problem.description),
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit,
                difficulty: problem.difficulty,
                tags: problem.tags || [],
                samples: samples
            };

            if (userId) {
                const subRepo = AppDataSource.getRepository(Submission);
                const pastSubs = await subRepo.find({
                    where: { problem: { id }, user: { id: userId } },
                    order: { submittedAt: 'DESC' },
                    select: { id: true, status: true, language: true, submittedAt: true, executionTimeMs: true }
                });
                if (pastSubs.length > 0) {
                    payload.pastSubmissions = pastSubs;
                }
                const sub = await this.submissionRepository.getLastAcceptedSubmission(id, userId);
                if (sub) {
                    payload.lastSubmission = { code: sub.code, language: sub.language };
                }
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'ProblemService', 'getProblemDetails', { id, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async bulkCreateProblems(dataset: any[]): Promise<ResponseData> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let problemsAdded = 0;
            let testCasesAdded = 0;

            for (const item of dataset) {
                const problem = new Problem();
                problem.title = item.title;
                problem.description = item.description;
                problem.difficulty = item?.difficulty || ProblemDifficulty.MEDIUM;
                problem.timeLimit = item.timeLimit || DEFAULT_TIME_LIMIT_SEC;
                problem.memoryLimit = item.memoryLimit || DEFAULT_MEMORY_LIMIT_MB;
                problem.tags = item.tags || [];
                
                const savedProblem = await queryRunner.manager.save(problem);
                problemsAdded++;

                if (item.testCases && Array.isArray(item.testCases)) {
                    const testCases = item.testCases.map((tc: any) => {
                        const testCase = new TestCase();
                        testCase.input = tc.input;
                        testCase.expectedOutput = tc.expectedOutput;
                        testCase.isHidden = tc.isHidden !== undefined ? tc.isHidden : true;
                        testCase.problem = savedProblem;
                        return testCase;
                    });
                    await queryRunner.manager.save(TestCase, testCases);
                    testCasesAdded += testCases.length;
                }
            }

            await queryRunner.commitTransaction();
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { problemsAdded, testCasesAdded });
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            ErrorLoggingUtils.logError(error, 'ProblemService', 'bulkCreateProblems');
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        } finally {
            await queryRunner.release();
        }
    }
}

export const problemService = Container.get(ProblemService);