import { Problem, ProblemDifficulty } from "../entities/Problem";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { TestCase } from "../entities/TestCase";

export class ProblemService {
    
    async createProblem(title: string, description: string,difficulty?: ProblemDifficulty, timeLimit?: number, memoryLimit?: number): Promise<Problem> {
        // TypeORM's create() builds the object in memory with entity defaults
        const problemData = problemRepository.create({
            title,
            description,
        });

        if(timeLimit !== undefined) {
            problemData.timeLimit = timeLimit;
        }
        if(memoryLimit !== undefined) {
            problemData.memoryLimit = memoryLimit;
        }
        if(difficulty !== undefined) {
            problemData.difficulty = difficulty;
        }
        // 4. Enforce the Enum at the database layer


        // Execute the insert transaction
        return await problemRepository.saveEntity(problemData);
    }

    public async bulkCreateProblems(dataset: any[]): Promise<{ problemsAdded: number; testCasesAdded: number }> {
        // Start a Database Transaction
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            let problemsAdded = 0;
            let testCasesAdded = 0;

            for (const item of dataset) {
                // 1. Create the Problem
                const problem = new Problem();
                problem.title = item.title;
                problem.description = item.description;
                problem.difficulty = item?.difficulty || ProblemDifficulty.MEDIUM; // Default to MEDIUM if not provided
                // Add your defaults from the DTO logic here if needed
                problem.timeLimit = item.timeLimit || 2;
                problem.memoryLimit = item.memoryLimit || 256;
                
                const savedProblem = await queryRunner.manager.save(problem);
                problemsAdded++;

                // 2. Create and link the Test Cases
                if (item.testCases && Array.isArray(item.testCases)) {
                    const testCases = item.testCases.map((tc: any) => {
                        const testCase = new TestCase();
                        testCase.input = tc.input;
                        testCase.expectedOutput = tc.expectedOutput;
                        testCase.isHidden = tc.isHidden !== undefined ? tc.isHidden : true;
                        testCase.problem = savedProblem; // Link to the parent problem
                        return testCase;
                    });

                    await queryRunner.manager.save(TestCase, testCases);
                    testCasesAdded += testCases.length;
                }
            }

            // Commit the transaction only if ALL problems and test cases succeed
            await queryRunner.commitTransaction();

            return { problemsAdded, testCasesAdded };

        } catch (error) {
            // If anything fails, rollback the entire batch to prevent data corruption
            await queryRunner.rollbackTransaction();
            console.error("❌ Bulk upload transaction failed. Rolling back...", error);
            throw error; // Throw so the controller catches it and sends a 500
        } finally {
            // Always release the connection back to the pool
            await queryRunner.release();
        }
    }
}

// Export a single instance to act as a Singleton across the API
export const problemService = new ProblemService();