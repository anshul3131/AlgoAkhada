import { SubmissionStatus } from "../entities/Submission";

export class SubmissionDTO {
    submissionId: string;
    problemId: string;
    language: string;
    code: string;
    status: SubmissionStatus;
}

export enum SubmissionMode{
    MATCH = 'match',
    UPSOLVE = 'upsolve'
}
