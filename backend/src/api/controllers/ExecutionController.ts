/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for code execution engine and supported compiler runtime querying
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Post, Get, Body, Res } from "routing-controllers";
import { Response } from "express";
import { Container, Service } from "typedi";
import { ExecutionService } from "../../domain/services/ExecutionService";
import { ExecuteCodeRequestDTO } from "../../domain/classes/ExecutionDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../../domain/classes/ResponseDTO";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@Service()
@JsonController("/api")
export class ExecutionController {
    private executionService: ExecutionService;

    constructor() {
        this.executionService = Container.get(ExecutionService);
    }

    @Get("/languages")
    public async getLanguages(@Res() res: Response) {
        const serviceResponse = await this.executionService.getSupportedLanguages();
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post("/execute")
    public async executeCode(
        @Body() body: ExecuteCodeRequestDTO,
        @Res() res: Response
    ) {
        if (!body.code || !body.language || !body.runMode) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        const serviceResponse = await this.executionService.executeCode(body);
        return ResponseBuilder.send(res, serviceResponse);
    }
}
