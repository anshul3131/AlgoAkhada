import { JsonController, Post, Get, Param, Body, Res, Authorized, Req } from "routing-controllers";
import { Response } from "express";
import { submissionService } from "../../domain/services/SubmissionService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { SubmitCodeDTO } from "../../domain/classes/SubmitCodeDTO";
import { RESPONSE_CODES } from "../../domain/classes/ResponseDTO";


@JsonController("/api/submissions")
@Authorized()
export class SubmissionController {
    
    @Post()
    async submitCode(
        @Req() req: any,
        @Body() body: SubmitCodeDTO, // Grab the entire body here
        @Res() res: Response
    ) {
        try {
            const userId = req.user.id;
            console.log(userId);
            
            // Destructure the payload safely
            const { problemId, language, code, mode, matchId } = body;

            // Validate all required fields are present
            if (!problemId || !language || !code) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Missing required fields", 400);
            }

            // Execute the transaction and queue the job in Kafka
            const submission = await submissionService.createSubmission(userId, problemId, language, code, mode, matchId);
            
            // Exclude the raw code from the response payload to keep the network response lightweight
            const responseData = {
                id: submission.id,
                language: submission.language,
                status: submission.status,
                executionTimeMs: submission.executionTimeMs,
                memoryUsedMb: submission.memoryUsedMb,
                submittedAt: submission.submittedAt
            };
            
            return ResponseBuilder.success(res,202, responseData);

        } catch (error: any) {
            console.error(`[SubmissionController] submitCode error: ${error.message}`);
            
            if (error.message === "USER_NOT_FOUND" || error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.error(res, "NOT_FOUND", error.message, 404);
            }
            
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get("/:submissionId")
    async getSubmission(
        @Param("submissionId") submissionId: string,
        @Res() res: Response
    ) {
        const serviceResponse = await submissionService.getSubmissionById(submissionId);
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data })
        }
        else {
            res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data })
        }
    }
}