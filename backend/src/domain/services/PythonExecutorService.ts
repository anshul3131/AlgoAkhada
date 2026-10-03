import { exec, spawn } from 'child_process';
import path from 'path';
import { SubmissionStatus } from '../entities/Submission';
import { CodeExecutor } from '../interfaces/CodeExecutor'; // Adjust path if needed

export class PythonExecutor extends CodeExecutor {
    protected fileExtension = 'py';
    protected executableExtension = 'py';
    
    protected compileNative(sourcePath: string, outPath: string, jobFolder: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            // Run the syntax check inside the docker container
            const syntaxCheckCmd = `docker exec -w /jobs/${jobId} cp-python-runner python3 -m py_compile main.py`;

            exec(syntaxCheckCmd, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    // We resolve true, meaning "Compilation/Syntax check passed"
                    resolve({ success: true });
                }
            });
        });
    }

    protected runBatch(executablePath: string, jobFolder: string, testCount: number, globalTimeLimitMs: number): Promise<void> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            
            const cmdArgs = [
                'exec',
                '-i',
                '-w', `/jobs/${jobId}`,
                'cp-python-runner',
                'bash',
                'runner.sh',
                testCount.toString(),
                'python3 main.py',
                globalTimeLimitMs.toString()
            ];

            const child = spawn('docker', cmdArgs);

            const timeoutId = setTimeout(() => {
                child.kill('SIGKILL');
                resolve();
            }, globalTimeLimitMs + 5000); // Docker overhead buffer

            child.on('close', () => {
                clearTimeout(timeoutId);
                resolve();
            });
        });
    }
}

export const pythonExecutor = new PythonExecutor();