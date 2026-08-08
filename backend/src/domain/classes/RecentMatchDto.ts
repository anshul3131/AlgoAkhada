import { MatchResult } from "../enums/MatchResult";
import { MatchAction } from "../enums/MatchAction";

export class RecentMatchDTO {
    matchId: string;
    opponentName: string;
    problemId: string;
    problemTitle: string;
    result: MatchResult;
    action: MatchAction;
    submissionId: string | null;
    submittedAt: Date | null;
}

export class GetRecentMatchesResponseDTO {
    success: boolean;
    data?: RecentMatchDTO[];
    error?: string;
}
