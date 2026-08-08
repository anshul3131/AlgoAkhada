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

    protected runNative(executablePath: string, inputPath: string, jobFolder: string, remainingTimeMs: number): Promise<{ status: any, output: string, executionTimeMs?: number }> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            
            // Execute the python script inside the long-running docker container
            const cmdArgs = [
                'exec',
                '-i',
                '-w', `/jobs/${jobId}`,
                'cp-python-runner',
                'bash',
                '-c',
                // Adding a basic memory limit using ulimit for the bash process and its children. 
                // Note: Python sometimes pre-allocates memory, so ulimit -v might be tricky, but it's a good safety net.
                `ulimit -v 256000; ulimit -u 64; TIMEFORMAT="EXEC_TIME:%3R"; time python3 main.py < input.txt`
            ];

            const child = spawn('docker', cmdArgs);

            let stdoutData = '';
            let stderrData = '';

            child.stdout.on('data', (data) => { stdoutData += data.toString(); });
            child.stderr.on('data', (data) => { stderrData += data.toString(); });

            const NODE_BUFFER = 2000;
            const timeoutId = setTimeout(() => {
                child.kill('SIGKILL');
                resolve({ status: 'Time Limit Exceeded', output: '' });
            }, remainingTimeMs + NODE_BUFFER);

            child.on('close', (code) => {
                clearTimeout(timeoutId);

                let exactTimeMs = 0;
                
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

export const pythonExecutor = new PythonExecutor();