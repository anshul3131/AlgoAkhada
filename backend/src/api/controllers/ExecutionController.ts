import { JsonController, Post, Get, Body, Res } from "routing-controllers";
import { Response } from "express";
import { executionService } from "../../domain/services/ExecutionService";
import { ExecuteCodeRequestDTO } from "../../domain/classes/ExecutionDTO";
import { RESPONSE_CODES, RESPONSE_MESSAGES } from "../../domain/classes/ResponseDTO";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@JsonController("/api")
export class ExecutionController {

    @Get("/languages")
    async getLanguages(@Res() res: Response) {
        const serviceResponse = await executionService.getSupportedLanguages();
        
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
            return res;
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
            return res;
        }
    }

    @Post("/execute")
    async executeCode(
        @Body() body: ExecuteCodeRequestDTO,
        @Res() res: Response
    ) {
        if (!body.code || !body.language || !body.runMode) {
            res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
            return res;
        }

        const serviceResponse = await executionService.executeCode(body);
        
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
            return res;
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
            return res;
        }
    }
}
