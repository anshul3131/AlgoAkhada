/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for problem catalog, difficulty filtering, problem details, and bulk ingestion
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Post, Get, Body, Param, QueryParam, Res, Req, Authorized } from "routing-controllers";
import { Response } from "express";
import { Container, Service } from "typedi";
import { ProblemService } from "../../domain/services/ProblemService";
import { CreateProblemDTO } from "../../domain/classes/CreateProblemDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../../domain/classes/ResponseDTO";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@Service()
@JsonController("/api/problems")
@Authorized()
export class ProblemController {
    private problemService: ProblemService;

    constructor() {
        this.problemService = Container.get(ProblemService);
    }

    @Post()
    public async createProblem(
        @Body() body: CreateProblemDTO,
        @Res() res: Response
    ) {
        const { title, description, difficulty, timeLimit, memoryLimit } = body;
        
        if (!title || !description) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        const serviceResponse = await this.problemService.createProblem(title, description, difficulty, timeLimit, memoryLimit);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/tags")
    public async getTags(@Res() res: Response) {
        const serviceResponse = await this.problemService.getTags();
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/metadata")
    public async getMetadata(@Res() res: Response) {
        const serviceResponse = await this.problemService.getProblemMetadata();
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get()
    public async getAllProblems(
        @QueryParam("page") page: number,
        @QueryParam("limit") limit: number,
        @QueryParam("difficulty") difficulty: string,
        @QueryParam("search") search: string,
        @QueryParam("tag") tag: string,
        @QueryParam("hideSolved") hideSolved: boolean,
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user?.id;
        const serviceResponse = await this.problemService.getAllProblems(page, limit, difficulty, search, tag, userId, hideSolved);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/:id")
    public async getProblem(
        @Param("id") id: string,
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user?.id;
        const serviceResponse = await this.problemService.getProblemDetails(id, userId);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post("/bulk")
    public async bulkUpload(
        @Body() body: { dataset: any[] },
        @Res() res: Response
    ) {
        const { dataset } = body;
        
        if (!dataset || !Array.isArray(dataset)) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Invalid payload. Expected a 'dataset' array."));
        }

        const serviceResponse = await this.problemService.bulkCreateProblems(dataset);
        return ResponseBuilder.send(res, serviceResponse);
    }
}