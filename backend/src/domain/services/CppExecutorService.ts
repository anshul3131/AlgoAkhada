import { exec, spawn } from 'child_process';
import path from 'path';
import { SubmissionStatus } from '../entities/Submission'; // Ensure this matches your path
import { CodeExecutor} from '../interfaces/CodeExecutor';


export class CppExecutor extends CodeExecutor{
    protected fileExtension = 'cpp';
    protected executableExtension = 'out';
    
    protected compileNative(sourcePath: string, outPath: string, jobFolder: string): Promise<{ success: boolean; error?: string }> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            // Replaced direct execution with docker exec against long-running container
            const nativeCompileCmd = `docker exec -w /jobs/${jobId} cp-cpp-runner g++ -O2 main.cpp -o main.out`;

            exec(nativeCompileCmd, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message });
                } else {
                    resolve({ success: true });
                }
            });
        });
    }

    protected runNative(executablePath: string, inputPath: string, jobFolder: string, remainingTimeMs: number): Promise<{ status: any, output: string, executionTimeMs?: number }> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            
            // Execute the binary directly using docker exec inside the long-running container
            const cmdArgs = [
                'exec',
                '-i',
                '-w', `/jobs/${jobId}`,
                'cp-cpp-runner',
                'bash',
                '-c',
                `ulimit -v 256000; ulimit -u 64; TIMEFORMAT="EXEC_TIME:%3R"; time ./main.out < input.txt`
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

                if (code === 137) { // 137 is the standard exit code when killed by SIGKILL
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