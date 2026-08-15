import { JsonController, Post, Get, Body, Param, QueryParam, Res, Req, Authorized } from "routing-controllers";
import { Response } from "express";
import { problemService } from "../../domain/services/ProblemService";
import { CreateProblemDTO } from "../../domain/classes/CreateProblemDTO";
import { RESPONSE_CODES } from "../../domain/classes/ResponseDTO";

@JsonController("/api/problems")
@Authorized()
export class ProblemController {

    @Post()
    async createProblem(
        @Body() body: CreateProblemDTO,
        @Res() res: Response
    ) {
        const { title, description, difficulty, timeLimit, memoryLimit } = body;
        
        if (!title || !description) {
            return res.status(400).send({ success: false, data: "Missing required fields" });
        }

        const serviceResponse = await problemService.createProblem(title, description, difficulty, timeLimit, memoryLimit);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }

    @Get("/tags")
    async getTags(@Res() res: Response) {
        const serviceResponse = await problemService.getTags();
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
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
        const serviceResponse = await problemService.getAllProblems(page, limit, difficulty, search, tag);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }

    @Get("/:id")
    async getProblem(
        @Param("id") id: string,
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user?.id;
        const serviceResponse = await problemService.getProblemDetails(id, userId);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }

    @Post("/bulk")
    async bulkUpload(
        @Body() body: { dataset: any[] },
        @Res() res: Response
    ) {
        const { dataset } = body;
        
        if (!dataset || !Array.isArray(dataset)) {
            return res.status(400).send({ success: false, data: "Invalid payload. Expected a 'dataset' array." });
        }

        const serviceResponse = await problemService.bulkCreateProblems(dataset);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(201).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }
}