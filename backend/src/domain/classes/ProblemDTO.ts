export class ProblemSampleDTO {
    id: string;
    name: string;
    input: string;
    output: string;
    explanation?: string;
}

export class LastSubmissionDTO {
    code: string;
    language: string;
}

export class ProblemDetailDTO {
    id: string;
    title: string;
    description: string;
    timeLimit: number;
    memoryLimit: number;
    difficulty: string;
    tags: string[];
    samples?: ProblemSampleDTO[];
    lastSubmission?: LastSubmissionDTO;
}

export class ProblemListItemDTO {
    id: string;
    title: string;
    difficulty: string;
    tags: string[];
    timeLimit: number;
    memoryLimit: number;
}

export class ProblemListResponseDTO {
    items: ProblemListItemDTO[];
    page: number;
    limit: number;
    total: number;
}

export class TagsResponseDTO {
    tags: string[];
}
