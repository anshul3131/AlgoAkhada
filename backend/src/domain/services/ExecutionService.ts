import { ExecuteCodeRequestDTO, LanguageResponseDTO, RunMode, ExecutionResponseDTO } from "../classes/ExecutionDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { Language } from "../enums/CodeLanguage";
import { cppExecutor } from "./CppExecutorService";
import { pythonExecutor } from "./PythonExecutorService";
import { ExecutionResult } from "../interfaces/CodeExecutor";
import { TestCase } from "../entities/TestCase";

export class ExecutionService {

    public async getSupportedLanguages(): Promise<ResponseData> {
        const payload: LanguageResponseDTO[] = [
            { id: Language.CPP, name: "C++ 20", fileExtension: ".cpp" },
            { id: Language.PYTHON, name: "Python 3.11", fileExtension: ".py" }
        ];
        return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
    }

    public async executeCode(requestDTO: ExecuteCodeRequestDTO): Promise<ResponseData> {
        try {
            const { problemId, language, code, runMode, sampleIds, inputs, timeoutMs } = requestDTO;

            let testCasesToRun: TestCase[] = [];

            if (runMode === RunMode.SAMPLES) {
                if (!problemId) {
                    return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
                }
                
                const problem = await problemRepository.getProblemById(problemId);
                if (!problem) {
                    return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND);
                }

                // Filter test cases where isHidden is false
                let availableSamples = (problem.testCases || []).filter(tc => !tc.isHidden);

                if (sampleIds && Array.isArray(sampleIds) && sampleIds.length > 0) {
                    availableSamples = availableSamples.filter(tc => sampleIds.includes(tc.id));
                }
                
                testCasesToRun = availableSamples;

            } else if (runMode === RunMode.CUSTOM) {
                if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
                    return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
                }
                // Mock a test case for each custom input
                testCasesToRun = inputs.map((inp, index) => ({ id: `custom-${index + 1}`, input: inp, expectedOutput: "" } as TestCase));
            } else {
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
            }

            if (testCasesToRun.length === 0) {
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND);
            }

            // Await execution synchronously
            const timeLimit = timeoutMs ? timeoutMs / 1000 : 2; 
            let response: ExecutionResult;
            
            switch (language) {
                case Language.CPP:
                    response = await cppExecutor.execute(code, testCasesToRun, timeLimit, true);
                    break;
                case Language.PYTHON:
                    response = await pythonExecutor.execute(code, testCasesToRun, timeLimit, true);
                    break;
                default:
                    return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
            }

            const payload: ExecutionResponseDTO = {
                status: response.status,
                aggregated: {
                    passed: response.passed,
                    total: response.total
                },
                testCaseResults: response.testCaseResults,
                failedTestCase: response.failedTestCase,
                compileError: response.compileError
            } as ExecutionResponseDTO;

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);

        } catch (error: any) {
            console.error(`[ExecutionService] executeCode error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const executionService = new ExecutionService();
