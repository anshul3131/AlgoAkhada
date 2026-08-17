export class CustomParticipantDTO {
    userId: string;
    username: string;
    status: string;
    score: number | null;
}

export class CustomMatchDTO {
    id: string;
    hostId: string;
    problemId?: string;
    timeLimit: number;
    maxParticipants: number;
    joinCode: string;
    startedAt?: string;
    topic: string;
    status: string;
    participants: CustomParticipantDTO[];

    static fromEntity(entity: any): CustomMatchDTO {
        const dto = new CustomMatchDTO();
        dto.id = entity.id;
        dto.hostId = entity.hostId;
        dto.problemId = entity.problemId;
        dto.timeLimit = entity.timeLimit;
        dto.maxParticipants = entity.maxParticipants;
        dto.joinCode = entity.joinCode;
        if (entity.startedAt) dto.startedAt = entity.startedAt.toISOString();
        dto.topic = entity.topic;
        dto.status = entity.status;
        dto.participants = entity.participants;
        return dto;
    }
}
