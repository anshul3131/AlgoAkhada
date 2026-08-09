import { JsonController, Post, Get, Body, Param, QueryParam, Res, Authorized } from "routing-controllers";
import { Response } from "express";
import { problemService } from "../../domain/services/ProblemService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import {problemRepository} from "../../infrastructure/database/repositories/ProblemRepository";
import { CreateProblemDTO } from "../../domain/classes/CreateProblemDTO";
import { ProblemDifficulty } from "../../domain/entities/Problem";
import { ProblemTag } from "../../domain/enums/ProblemTag";


@JsonController("/api/problems")
// @Authorized()
export class ProblemController {

    @Post()
    async createProblem(
        @Body() body: CreateProblemDTO,
        @Res() res: Response
    ) {
        try {
            // Destructure safely from the typed DTO
            const { title, description,difficulty, timeLimit, memoryLimit } = body;

            // Basic validation
            if (!title || !description) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Missing required fields", 400);
            }

            const problem = await problemService.createProblem(title, description,difficulty, timeLimit, memoryLimit);
            return ResponseBuilder.success(res,200, problem,"Problem Created Successfuly");

        } catch (error: any) {
            console.error(`[ProblemController] createProblem error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get("/tags")
    async getTags(
        @Res() res: Response
    ) {
        try {
            return ResponseBuilder.success(res, 200, {
                tags: Object.values(ProblemTag)
            });
        } catch (error: any) {
            console.error(`[ProblemController] getTags error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get()
    async getAllProblems(
        @QueryParam("page") page: number,
        @QueryParam("limit") limit: number,
        @QueryParam("difficulty") difficulty: string,
        @QueryParam("search") search: string,
        @QueryParam("tag") tag: string,
        @Res() res: Response
    ) {
        try {
            page = page ? Number(page) : 1;
            limit = limit ? Number(limit) : 20;
            difficulty = difficulty || ProblemDifficulty.MEDIUM;

            const result = await problemRepository.getAllProblems(page, limit, difficulty, search, tag);
            
            // Format exactly as the requested contract
            const responsePayload = {
                items: result.problems.map(p => ({
                    id: p.id,
                    title: p.title,
                    difficulty: p.difficulty,
                    tags: p.tags || [],
                    timeLimit: p.timeLimit,
                    memoryLimit: p.memoryLimit
                })),
                page: result.page,
                limit: result.limit,
                total: result.total
            };

            return ResponseBuilder.success(res, 200, responsePayload);

        } catch (error: any) {
            console.error(`[ProblemController] getAllProblems error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get("/:id")
    async getProblem(
        @Param("id") id: string,
        @Res() res: Response
    ) {
        try {
            const problem = await problemRepository.getProblemById(id);
            return ResponseBuilder.success(res,200, problem);

        } catch (error: any) {
            console.error(`[ProblemController] getProblem error: ${error.message}`);

            if (error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.error(res, "NOT_FOUND", "Problem not found", 404);
            }

            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Post("/bulk")
    async bulkUpload(
        @Body() body: { dataset: any[] }, // Accept the dataset array from the request
        @Res() res: Response
    ) {
        try {
            const { dataset } = body;
            console.log("Received dataset for bulk upload:", dataset);

            // Validate payload structure
            if (!dataset || !Array.isArray(dataset)) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Invalid payload. Expected a 'dataset' array.", 400);
            }

            // Delegate the heavy database transaction to the service layer
            const stats = await problemService.bulkCreateProblems(dataset);
            return ResponseBuilder.success(res,201, {
                message: "Dataset ingested successfully!",
                stats
            });

        } catch (error: any) {
            console.error(`[ProblemController] bulkUpload error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Failed to ingest dataset. Transaction rolled back.", 500);
        }
    }
}