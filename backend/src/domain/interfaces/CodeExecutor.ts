import path from "path";
import { SubmissionStatus } from "../entities/Submission";
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { TestCase } from "../entities/TestCase";


export interface ExecutionResult {
    status: SubmissionStatus;
    passed: number;
    total: number;
    failedTestCase?: TestCase;
}


export abstract class CodeExecutor {
    protected tempDir: string;
    protected abstract fileExtension: string;
    protected abstract executableExtension: string;

    constructor() {
        // Use process.cwd() so it maps to the backend root directory.
        // This makes it easy to mount the directory into a Docker container.
        this.tempDir = path.join(process.cwd(), 'temp_executions');
    }

    public async execute(code: string, testCases: TestCase[], timeLimit = 2): Promise<ExecutionResult> {
        const jobId = uuidv4();
        const jobFolder = path.join(this.tempDir, jobId);
        const sourceFile = path.join(jobFolder, `main.${this.fileExtension}`);
        const executable = path.join(jobFolder,`main.${this.executableExtension}`);

        const globalTimeLimitMs = timeLimit * 1000;

        try {
            // 1. Setup
            await fs.mkdir(jobFolder, { recursive: true });
            await fs.writeFile(sourceFile, code);

            // 2. Compile Natively (No Docker)
            const compileResult = await this.compileNative(sourceFile, executable, jobFolder);
            if (!compileResult.success) {
                console.error("🚨 Native Compilation Error:", compileResult.error);
                return { status: SubmissionStatus.COMPILATION_ERROR, passed: 0, total: testCases.length };
            }

            // 3. Execute Native Code
            let passedCount = 0;
            let totalExecutionTimeMs = 0;

            for (const tc of testCases) {
                const inputFilePath = path.join(jobFolder, 'input.txt');
                await fs.writeFile(inputFilePath, tc.input.trim() + '\n');

                const remainingTimeMs = globalTimeLimitMs - totalExecutionTimeMs;

                // Run the compiled binary directly
                const result = await this.runNative(executable, inputFilePath, jobFolder, remainingTimeMs);

                totalExecutionTimeMs += (result.executionTimeMs || 0);

                // Global TLE Check
                if (totalExecutionTimeMs > globalTimeLimitMs || result.status === 'Time Limit Exceeded') {
                    return { status: SubmissionStatus.TIME_LIMIT_EXCEEDED, passed: passedCount, total: testCases.length, failedTestCase: tc };
                }

                // Standard Error Checks
                if (result.status !== 'Success') {
                    console.error(`🚨 Runtime Error Details:`, result.output);
                    return { status: result.status, passed: passedCount, total: testCases.length, failedTestCase: tc };
                }

                // Output Comparison
                if (result.output.trim() === tc.expectedOutput.trim()) {
                    passedCount++;
                } else {
                    return { status: SubmissionStatus.WRONG_ANSWER, passed: passedCount, total: testCases.length, failedTestCase: tc };
                }
            }
            return { status: SubmissionStatus.ACCEPTED, passed: passedCount, total: testCases.length };

        } finally {
            // 4. Cleanup
            await fs.rm(jobFolder, { recursive: true, force: true }).catch(() => { });
        }
    }

    protected abstract compileNative(sourcePath: string, outPath: string, jobFolder: string): Promise<{ success: boolean; error?: string }>;

    protected abstract runNative(executablePath: string, inputPath: string, jobFolder: string, remainingTimeMs: number): Promise<{ status: any, output: string, executionTimeMs?: number }>;
}

