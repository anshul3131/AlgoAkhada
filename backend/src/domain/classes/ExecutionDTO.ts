import { Language } from "../enums/CodeLanguage";

export enum RunMode {
    SAMPLES = "samples",
    CUSTOM = "custom"
}

export class ExecuteCodeRequestDTO {
    problemId?: string;
    language!: Language;
    code!: string;
    runMode!: RunMode;
    sampleIds?: string[];
    inputs?: string[];
    timeoutMs?: number;
}

export class LanguageResponseDTO {
    id!: Language;
    name!: string;
    fileExtension!: string;
}

export class ExecutionAggregatedResultDTO {
    passed!: number;
    total!: number;
}

export class ExecutionResponseDTO {
    status!: string;
    aggregated!: ExecutionAggregatedResultDTO;
    testCaseResults?: any[];
    failedTestCase?: any;
    compileError?: string;
}
