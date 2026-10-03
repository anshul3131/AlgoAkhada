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

    protected runBatch(executablePath: string, jobFolder: string, testCount: number, globalTimeLimitMs: number): Promise<void> {
        return new Promise((resolve) => {
            const jobId = path.basename(jobFolder);
            
            const cmdArgs = [
                'exec',
                '-i',
                '-w', `/jobs/${jobId}`,
                'cp-cpp-runner',
                'bash',
                'runner.sh',
                testCount.toString(),
                './main.out',
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

export const cppExecutor = new CppExecutor();