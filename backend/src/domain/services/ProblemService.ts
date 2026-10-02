import { Submission, SubmissionStatus } from "../entities/Submission";

import { Problem, ProblemDifficulty } from "../entities/Problem";
import { ProblemRepository, problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { submissionRepository } from "../../infrastructure/database/repositories/SubmissionRepository";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { TestCase } from "../entities/TestCase";
import { ProblemTag } from "../enums/ProblemTag";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { ProblemDetailDTO, ProblemListResponseDTO, ProblemSampleDTO, TagsResponseDTO } from "../classes/ProblemDTO";
import { ProblemFormatter } from "../../utils/ProblemFormatter";

export class ProblemService {
    
    async createProblem(title: string, description: string,difficulty?: ProblemDifficulty, timeLimit?: number, memoryLimit?: number): Promise<ResponseData> {
        try {
            const problemData = new Problem();
            problemData.title = title;
            problemData.description = description;
            problemData.difficulty = difficulty || ProblemDifficulty.MEDIUM; 
            problemData.timeLimit = timeLimit || 2;
            problemData.memoryLimit = memoryLimit || 256;
            
            const saved = await problemRepository.saveEntity(problemData);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, "Problem Created Successfuly", saved);
        } catch (error: any) {
            console.error(`[ProblemService] createProblem error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    async getTags(): Promise<ResponseData> {
        try {
            const data: TagsResponseDTO = { tags: Object.values(ProblemTag) };
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[ProblemService] getTags error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    async getAllProblems(page: number, limit: number, difficulty: string, search: string, tag: string, userId?: string): Promise<ResponseData> {
        try {
            page = page ? Number(page) : 1;
            limit = limit ? Number(limit) : 20;

            const result = await problemRepository.getAllProblems(page, limit, difficulty, search, tag);
            
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
            console.error(`[ProblemService] getAllProblems error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    async getProblemDetails(id: string, userId?: string): Promise<ResponseData> {
        try {
            const problem = await problemRepository.getProblemById(id);
            if (!problem) {
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, "Problem not found");
            }

            const samples : ProblemSampleDTO[] = (problem.testCases || [])
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
                console.log("pastSubs for problem", id, userId, ":", pastSubs);
                if (pastSubs.length > 0) {
                    payload.pastSubmissions = pastSubs;
                }
                const sub = await submissionRepository.getLastAcceptedSubmission(id, userId);
                if (sub) {
                    payload.lastSubmission = { code: sub.code, language: sub.language };
                }
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error(`[ProblemService] getProblemDetails error: ${error.message}`);
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
                problem.timeLimit = item.timeLimit || 2;
                problem.memoryLimit = item.memoryLimit || 256;
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
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, "Dataset ingested successfully!", { problemsAdded, testCasesAdded });
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            console.error("❌ Bulk upload transaction failed. Rolling back...", error);
            return ResponseData.build(RESPONSE_CODES.FAILURE, "Failed to ingest dataset. Transaction rolled back.");
        } finally {
            await queryRunner.release();
        }
    }
}

// Export a single instance to act as a Singleton across the API
export const problemService = new ProblemService();