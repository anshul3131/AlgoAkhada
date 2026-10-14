export class PublicLobbyDTO {
    id: string;
    hostId?: string;
    hostUsername?: string;
    timeLimit: number;
    maxParticipants: number;
    joinCode: string;
    topic: string;
    name?: string;
    difficulty?: string;
    participantCount: number;
}
