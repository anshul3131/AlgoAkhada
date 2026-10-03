import path from "path";
import { SubmissionStatus } from "../entities/Submission";
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { TestCase } from "../entities/TestCase";


export interface TestCaseExecutionResult {
    testCaseId: string;
    input: string;
    status: SubmissionStatus | 'SUCCESS';
    output: string;
    expectedOutput: string;
    executionTimeMs: number;
}

export interface ExecutionResult {
    status: SubmissionStatus;
    passed: number;
    total: number;
    failedTestCase?: TestCase;
    executionTimeMs?: number;
    testCaseResults?: TestCaseExecutionResult[];
    compileError?: string;
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

    public async execute(code: string, testCases: TestCase[], timeLimit = 2, isRunMode = false): Promise<ExecutionResult> {
        const jobId = uuidv4();
        const jobFolder = path.join(this.tempDir, jobId);
        const sourceFile = path.join(jobFolder, `main.${this.fileExtension}`);
        const executable = path.join(jobFolder, `main.${this.executableExtension}`);

        const globalTimeLimitMs = timeLimit * 1000;
        const testCaseResults: TestCaseExecutionResult[] = [];

        try {
            // 1. Setup
            await fs.mkdir(jobFolder, { recursive: true });
            await fs.writeFile(sourceFile, code);

            // 2. Compile Natively
            const compileResult = await this.compileNative(sourceFile, executable, jobFolder);
            if (!compileResult.success) {
                console.error("🚨 Native Compilation Error:", compileResult.error);
                return { status: SubmissionStatus.COMPILATION_ERROR, passed: 0, total: testCases.length, testCaseResults: [], compileError: compileResult.error || "" };
            }

            // 3. Write all inputs and generate runner.sh
            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                if (!tc) continue;
                const inputFilePath = path.join(jobFolder, `input_${i}.txt`);
                await fs.writeFile(inputFilePath, tc.input.trim() + '\n');
            }

            const runnerScript = `#!/bin/bash
ulimit -v 256000
ulimit -u 64
TEST_COUNT=$1
COMMAND=$2
GLOBAL_TLE_MS=$3

total_time=0
for ((i=0; i<TEST_COUNT; i++)); do
    start_time=$(date +%s%3N)
    
    timeout 5s bash -c "$COMMAND < input_$i.txt > output_$i.txt 2> stderr_$i.txt"
    EXIT_CODE=$?
    
    end_time=$(date +%s%3N)
    exec_time=$((end_time - start_time))
    total_time=$((total_time + exec_time))
    
    echo "$EXIT_CODE,$exec_time" > status_$i.txt

    if [ $total_time -gt $GLOBAL_TLE_MS ]; then
        break
    fi
done
`;
            await fs.writeFile(path.join(jobFolder, 'runner.sh'), runnerScript);
            await fs.chmod(path.join(jobFolder, 'runner.sh'), 0o777);

            // 4. Run the batch script (1 single docker exec overhead!)
            await this.runBatch(executable, jobFolder, testCases.length, globalTimeLimitMs);

            // 5. Evaluate the results
            let passedCount = 0;
            let totalExecutionTimeMs = 0;

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                if (!tc) continue;

                let output = "";
                let stderrData = "";
                let exitCode = -1;
                let execTime = 0;

                try {
                    output = await fs.readFile(path.join(jobFolder, `output_${i}.txt`), 'utf8');
                    stderrData = await fs.readFile(path.join(jobFolder, `stderr_${i}.txt`), 'utf8');
                    const statusStr = await fs.readFile(path.join(jobFolder, `status_${i}.txt`), 'utf8');
                    const parts = statusStr.trim().split(',');
                    exitCode = parseInt(parts[0] || "-1", 10);
                    execTime = parseInt(parts[1] || "0", 10);
                } catch (e) {
                    // File doesn't exist, which means runner.sh halted early due to global TLE!
                    exitCode = -1;
                }

                totalExecutionTimeMs += execTime;

                let tcStatus: SubmissionStatus = SubmissionStatus.ACCEPTED;
                let tcPassed = false;

                if (exitCode === -1 || totalExecutionTimeMs > globalTimeLimitMs) {
                    tcStatus = SubmissionStatus.TIME_LIMIT_EXCEEDED;
                } else if (exitCode === 124 || exitCode === 137) {
                    tcStatus = SubmissionStatus.TIME_LIMIT_EXCEEDED;
                } else if (exitCode !== 0) {
                    tcStatus = SubmissionStatus.RUNTIME_ERROR;
                } else {
                    const isCustomRunMode = isRunMode && (!tc.expectedOutput || tc.expectedOutput.trim() === "");
                    if (isCustomRunMode || output.trim() === tc.expectedOutput?.trim()) {
                        tcPassed = true;
                        passedCount++;
                    } else {
                        tcStatus = SubmissionStatus.WRONG_ANSWER;
                    }
                }

                if (isRunMode) {
                    testCaseResults.push({
                        testCaseId: tc.id,
                        input: tc.input,
                        status: tcStatus,
                        output: output,
                        expectedOutput: tc.expectedOutput || "",
                        executionTimeMs: execTime
                    });
                }

                if (!isRunMode && !tcPassed) {
                    return { status: tcStatus, passed: passedCount, total: testCases.length, failedTestCase: tc, executionTimeMs: totalExecutionTimeMs };
                }
            }

            let finalStatus = SubmissionStatus.ACCEPTED;
            if (isRunMode && passedCount < testCases.length) {
                const firstFailed = testCaseResults.find(r => r.status !== SubmissionStatus.SUCCESS && r.status !== 'Accepted');
                finalStatus = firstFailed ? firstFailed.status as SubmissionStatus : SubmissionStatus.WRONG_ANSWER;
            }

            return { status: finalStatus, passed: passedCount, total: testCases.length, testCaseResults: isRunMode ? testCaseResults : undefined, executionTimeMs: totalExecutionTimeMs } as ExecutionResult;

        } finally {
            // Cleanup
            await fs.rm(jobFolder, { recursive: true, force: true }).catch(() => { });
        }
    }

    protected abstract compileNative(sourcePath: string, outPath: string, jobFolder: string): Promise<{ success: boolean; error?: string }>;

    protected abstract runBatch(executablePath: string, jobFolder: string, testCount: number, globalTimeLimitMs: number): Promise<void>;
}

