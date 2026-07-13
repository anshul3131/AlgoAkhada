import { JsonController, Post, Body, Res } from "routing-controllers";
import { Response } from "express";
import { testCaseService } from "../../domain/services/TestCaseService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { UploadTestCasesDTO } from "../../domain/classes/UploadTestCasesDTO";


// 2. Simplify the base route
@JsonController("/api/testcases")
export class TestCaseController {
    
    @Post("/batch-upload")
    async uploadTestCases(
        @Body() body: UploadTestCasesDTO, // Grab the entire payload here
        @Res() res: Response
    ) {
        try {
            // 3. Destructure both fields from the body
            const { problemId, fileUrl } = body;

            // 4. Validate that both exist
            if (!problemId || !fileUrl) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Both problemId and fileUrl are required", 400);
            }

            // Queue the job via the service layer
            await testCaseService.queueTestCaseBatchUpload(problemId, fileUrl);
            
            // Return 202 Accepted
            return ResponseBuilder.success(res, { 
                message: "Test case upload queued for processing.",
                problemId 
            }, 202);

        } catch (error: any) {
            console.error(`[TestCaseController] uploadTestCases error: ${error.message}`);
            
            if (error.message === "PROBLEM_NOT_FOUND") {
                return ResponseBuilder.error(res, "NOT_FOUND", "Problem not found", 404);
            }
            
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }
}