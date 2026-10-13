export class LiveMatchPlayerDTO {
    id?: string;
    username?: string;
    elo?: number;
}

export class LiveMatchDTO {
    matchId: string;
    user1: LiveMatchPlayerDTO;
    user2: LiveMatchPlayerDTO;
    problemTitle?: string;
    problemId?: string;
    createdAt: Date;
}
