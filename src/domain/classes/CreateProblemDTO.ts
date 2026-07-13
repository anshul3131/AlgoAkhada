import { ProblemDifficulty } from "../entities/Problem";

// Strict DTO interface for payload validation
export interface CreateProblemDTO {
    title: string;
    description: string;
    difficulty : ProblemDifficulty;
    timeLimit?: number;
    memoryLimit?: number;
}