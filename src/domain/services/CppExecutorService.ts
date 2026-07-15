import { exec, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SubmissionStatus } from '../entities/Submission'; // Ensure this matches your path

interface TestCase {
    input: string;
    expectedOutput: string;
}

interface ExecutionResult {
    status: SubmissionStatus | any;
    passed: number;
    total: number;
    failedTestCase?: TestCase;
}

export class CppExecutor {
    private tempDir: string;

    constructor() {
        this.tempDir = path.join(__dirname, 'temp_executions');
    }

    public async execute(code: string, testCases: TestCase[], timeLimit = 2): Promise<ExecutionResult> {
        const jobId = uuidv4();
        const jobFolder = path.join(this.tempDir, jobId);
        const sourceFile = path.join(jobFolder, 'main.cpp');
        const executable = path.join(jobFolder, 'main.out');
        
        // Unique container name for this specific submission to avoid parallel conflicts
        const containerName = `job-${jobId}`; 
        const globalTimeLimitMs = timeLimit * 1000;

        try {
            // 1. Setup
            await fs.mkdir(jobFolder, { recursive: true });
            await fs.writeFile(sourceFile, code);

            // 2. Compile
            const compileResult = await this.compile(sourceFile, executable);
            if (!compileResult.success) {
                return { status: SubmissionStatus.COMPILATION_ERROR, passed: 0, total: testCases.length };
            }

            // 3. Initialize: Boot the container ONCE in the background
            await this.startContainer(containerName, jobFolder);

            // 4. Execute: Run all test cases through the active container
            let passedCount = 0;
            let totalExecutionTimeMs = 0;

            for (const tc of testCases) {
                const inputFilePath = path.join(jobFolder, 'input.txt');
                await fs.writeFile(inputFilePath, tc.input.trim() + '\n');

                // Calculate how much time the user has left in their global limit
                const remainingTimeMs = globalTimeLimitMs - totalExecutionTimeMs;

                // Run the code via docker exec
                const result = await this.runInsideContainer(containerName, remainingTimeMs);

                // Add the exact C++ execution time to our global tracker
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
            // 5. Cleanup: Force kill the container and delete the folder
            await this.stopContainer(containerName);
            await fs.rm(jobFolder, { recursive: true, force: true }).catch(() => { });
        }
    }

    private compile(sourcePath: string, outPath: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const jobFolder = path.dirname(sourcePath);
            const dockerCompileCmd = `docker run --rm -v ${jobFolder}:/usr/src/app -w /usr/src/app gcc:latest g++ -O2 main.cpp -o main.out`;

            exec(dockerCompileCmd, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    private startContainer(containerName: string, jobFolder: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Runs a detached (-d) container that sleeps for 1 hour to keep it alive
            const cmd = `docker run -d --rm --name ${containerName} --network none --memory=256m --cpus=1.0 --pids-limit 64 -v ${jobFolder}:/usr/src/app -w /usr/src/app gcc:latest sleep 3600`;
            exec(cmd, (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    private stopContainer(containerName: string): Promise<void> {
        return new Promise((resolve) => {
            // Forcefully removes the container if it is still running
            exec(`docker rm -f ${containerName}`, () => resolve());
        });
    }

    private runInsideContainer(containerName: string, remainingTimeMs: number): Promise<{ status: any, output: string, executionTimeMs?: number }> {
        return new Promise((resolve) => {
            
            // Notice: We use 'exec' instead of 'run'. This skips the boot process entirely.
            const dockerCmdArgs = [
                'exec', '-i', containerName,
                'bash', '-c',
                'TIMEFORMAT="EXEC_TIME:%3R"; time ./main.out < input.txt'
            ];

            const child = spawn('docker', dockerCmdArgs);

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => { stdoutData += data.toString(); });
            child.stderr.on('data', (data) => { stderrData += data.toString(); });

            // We give Node a buffer to account for the ~30ms exec overhead
            const NODE_BUFFER = 2000;
            const timeoutId = setTimeout(() => {
                child.kill('SIGKILL');
                resolve({ status: 'Time Limit Exceeded', output: '' });
            }, remainingTimeMs + NODE_BUFFER);

            child.on('close', (code) => {
                clearTimeout(timeoutId);

                let exactTimeMs = 0;
                
                // Fixed the regex to match TIMEFORMAT output properly
                const timeMatch = stderrData.match(/EXEC_TIME:([0-9.]+)/);
                if (timeMatch && timeMatch[1]) {
                    exactTimeMs = Math.round(parseFloat(timeMatch[1]) * 1000);
                    stderrData = stderrData.replace(/EXEC_TIME:[0-9.]+\n?/, '');
                }

                if (code === 137) {
                    resolve({ status: SubmissionStatus.MEMORY_LIMIT_EXCEEDED || 'Memory Limit Exceeded', output: '' });
                } else if (code !== 0 && code !== null) {
                    resolve({ status: SubmissionStatus.RUNTIME_ERROR || 'Runtime Error', output: stderrData });
                } else {
                    resolve({ status: 'Success', output: stdoutData, executionTimeMs: exactTimeMs });
                }
            });
        });
    }
}

export const cppExecutor = new CppExecutor();