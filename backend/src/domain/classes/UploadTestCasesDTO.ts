// 1. Update the DTO to require both fields in the JSON body
export interface UploadTestCasesDTO {
    problemId: string;
    fileUrl: string;
}