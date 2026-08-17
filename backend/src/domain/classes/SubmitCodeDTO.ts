import { Language } from "../enums/CodeLanguage";
import { SubmissionMode } from "./SubmissionDTO";

export interface SubmitCodeDTO {
    problemId: string;
    language: Language;
    code: string;
    mode? : SubmissionMode;
    matchId?: string;
}