/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for code submission ingestion, query history, and individual submission inspection
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Post, Get, Param, QueryParam, Body, Res, Authorized, Req } from "routing-controllers";
import { Response } from "express";
import { Container } from "typedi";
import { SubmissionService } from "../../domain/services/SubmissionService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { SubmitCodeDTO } from "../../domain/classes/SubmitCodeDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../../domain/classes/ResponseDTO";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";

const ACCEPTED_HTTP_STATUS = 202;

@JsonController("/api/submissions")
@Authorized()
export class SubmissionController {
    private submissionService: SubmissionService;

    constructor() {
        this.submissionService = Container.get(SubmissionService);
    }
    
    @Post()
    public async submitCode(
        @Req() req: any,
        @Body() body: SubmitCodeDTO,
        @Res() res: Response
    ) {
        try {
            const userId = req.user.id;
            const { problemId, language, code, mode, matchId } = body;

            if (!problemId || !language || !code) {
                return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
            }

            const submission = await this.submissionService.createSubmission(userId, problemId, language, code, mode, matchId);
            
            const responseData = {
                id: submission.id,
                language: submission.language,
                status: submission.status,
                executionTimeMs: submission.executionTimeMs,
                memoryUsedMb: submission.memoryUsedMb,
                submittedAt: submission.submittedAt
            };
            
            return ResponseBuilder.success(res, ACCEPTED_HTTP_STATUS, responseData);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'SubmissionController', 'submitCode', req);
            
            if (error.message === "USER_NOT_FOUND" || error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.NOT_FOUND, error.message));
            }
            
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG));
        }
    }

    @Get()
    public async getUserSubmissions(
        @Req() req: any,
        @QueryParam("page") page: number,
        @QueryParam("limit") limit: number,
        @QueryParam("status") status: string,
        @QueryParam("topic") topic: string,
        @Res() res: Response
    ) {
        const userId = req.user.id;
        const serviceResponse = await this.submissionService.getUserSubmissions(userId, page, limit, status, topic);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/:submissionId")
    public async getSubmission(
        @Param("submissionId") submissionId: string,
        @Res() res: Response
    ) {
        const serviceResponse = await this.submissionService.getSubmissionById(submissionId);
        return ResponseBuilder.send(res, serviceResponse);
    }
}