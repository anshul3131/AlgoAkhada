import { JsonController, Post, Get, Body, Param, Res } from "routing-controllers";
import { Response } from "express";
import { problemService } from "../../domain/services/ProblemService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import {problemRepository} from "../../infrastructure/database/repositories/ProblemRepository";
import { CreateProblemDTO } from "../../domain/classes/CreateProblemDTO";


@JsonController("/api/problems")
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
            return ResponseBuilder.success(res, problem, 201);

        } catch (error: any) {
            console.error(`[ProblemController] createProblem error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get()
    async getAllProblems(@Res() res: Response) {
        try {
            const problems = await problemRepository.getAllProblems();
            return ResponseBuilder.success(res, problems, 200);

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
            return ResponseBuilder.success(res, problem, 200);

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
            return ResponseBuilder.success(res, {
                message: "Dataset ingested successfully!",
                stats
            }, 201);

        } catch (error: any) {
            console.error(`[ProblemController] bulkUpload error: ${error.message}`);
            return ResponseBuilder.error(res, "FAILURE", "Failed to ingest dataset. Transaction rolled back.", 500);
        }
    }
}