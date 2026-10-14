/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for async test case dataset batch uploading
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Post, Body, Res, Authorized } from "routing-controllers";
import { Response } from "express";
import { Container } from "typedi";
import { TestCaseService } from "../../domain/services/TestCaseService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { UploadTestCasesDTO } from "../../domain/classes/UploadTestCasesDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../../domain/classes/ResponseDTO";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";

const ACCEPTED_HTTP_STATUS = 202;

@JsonController("/api/testcases")
@Authorized()
export class TestCaseController {
    private testCaseService: TestCaseService;

    constructor() {
        this.testCaseService = Container.get(TestCaseService);
    }
    
    @Post("/batch-upload")
    public async uploadTestCases(
        @Body() body: UploadTestCasesDTO,
        @Res() res: Response
    ) {
        try {
            const { problemId, fileUrl } = body;

            if (!problemId || !fileUrl) {
                return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Both problemId and fileUrl are required"));
            }

            await this.testCaseService.queueTestCaseBatchUpload(problemId, fileUrl);
            
            return ResponseBuilder.success(res, ACCEPTED_HTTP_STATUS, { 
                message: "Test case upload queued for processing.",
                problemId 
            });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'TestCaseController', 'uploadTestCases');
            
            if (error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND));
            }
            
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG));
        }
    }
}