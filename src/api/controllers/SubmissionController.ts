import { JsonController, Post, Body, Res } from "routing-controllers";
import { Response } from "express";
import { submissionService } from "../../domain/services/SubmissionService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { SubmitCodeDTO } from "../../domain/classes/SubmitCodeDTO";


@JsonController("/api/submissions")
export class SubmissionController {
    
    @Post()
    async submitCode(
        @Body() body: SubmitCodeDTO, // Grab the entire body here
        @Res() res: Response
    ) {
        try {
            // Destructure the payload safely
            const { userId, problemId, language, code } = body;

            // Validate all required fields are present
            if (!userId || !problemId || !language || !code) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Missing required fields", 400);
            }

            // Execute the transaction and queue the job in Kafka
            const submission = await submissionService.createSubmission(userId, problemId, language, code);
            
            // Exclude the raw code from the response payload to keep the network response lightweight
            const { code: _, ...responseData } = submission;
            
            return ResponseBuilder.success(res, responseData, 202);

        } catch (error: any) {
            console.error(`[SubmissionController] submitCode error: ${error.message}`);
            
            if (error.message === "USER_NOT_FOUND" || error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.error(res, "NOT_FOUND", error.message, 404);
            }
            
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }
}