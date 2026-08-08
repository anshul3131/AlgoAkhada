import { Language } from "../enums/CodeLanguage";

export interface SubmitCodeDTO {
    problemId: string;
    language: Language;
    code: string;
}