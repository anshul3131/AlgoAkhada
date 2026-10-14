/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for running user code against sample and custom test cases in C++ and Python
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { ExecuteCodeRequestDTO, LanguageResponseDTO, RunMode, ExecutionResponseDTO } from "../classes/ExecutionDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { ProblemRepository, problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { Language } from "../enums/CodeLanguage";
import { cppExecutor } from "./CppExecutorService";
import { pythonExecutor } from "./PythonExecutorService";
import { ExecutionResult } from "../interfaces/CodeExecutor";
import { TestCase } from "../entities/TestCase";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { _SECOND_MS, EMPTY_STRING } from "../../constants/AppConstant";

const DEFAULT_TIMEOUT_SEC = 2;

@Service()
export class ExecutionService {
    private problemRepository: ProblemRepository;

    constructor() {
        this.problemRepository = problemRepository;
    }

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
                
                const problem = await this.problemRepository.getProblemById(problemId);
                if (!problem) {
                    return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND);
                }

                let availableSamples = (problem.testCases || []).filter(tc => !tc.isHidden);

                if (sampleIds && Array.isArray(sampleIds) && sampleIds.length > 0) {
                    availableSamples = availableSamples.filter(tc => sampleIds.includes(tc.id));
                }
                
                testCasesToRun = availableSamples;

            } else if (runMode === RunMode.CUSTOM) {
                if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
                    return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
                }
                testCasesToRun = inputs.map((inp, index) => ({ 
                    id: `custom-${index + 1}`, 
                    input: inp, 
                    expectedOutput: EMPTY_STRING 
                } as TestCase));
            } else {
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT);
            }

            if (testCasesToRun.length === 0) {
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NOT_FOUND);
            }

            const timeLimit = timeoutMs ? timeoutMs / _SECOND_MS : DEFAULT_TIMEOUT_SEC; 
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
            ErrorLoggingUtils.logError(error, 'ExecutionService', 'executeCode', { problemId: requestDTO.problemId, language: requestDTO.language });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const executionService = Container.get(ExecutionService);
