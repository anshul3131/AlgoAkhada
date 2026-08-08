import { matchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { matchHistoryRepository } from "../../infrastructure/database/repositories/MatchHistoryRepository";
import { MatchResult } from "../enums/MatchResult";
import { MatchAction } from "../enums/MatchAction";
import { RecentMatchDTO } from "../classes/RecentMatchDto";
import { Problem } from "../entities/Problem";
import { User } from "../entities/User";
import { Response } from "express";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { RESPONSE_CODES, RESPONSE_MESSAGES, ResponseData } from "../classes/ResponseDTO";

export class RecentMatchService {
    public async getRecentMatches(userId: string, limit: number = 10, res: Response): Promise<ResponseData> {
        try {
            const matches = await matchRepository.getRecentCompletedMatches(userId, limit);
            
            const data: RecentMatchDTO[] = [];
            for (const match of matches) {
                const isWinner = match.winner && match.winner.id === userId;
                const result = isWinner ? MatchResult.WIN : MatchResult.LOSE;
                const action = isWinner ? MatchAction.VIEW_SOLUTION : MatchAction.UPSOLVE;
                
                const opponent : User = match.user1.id === userId ? match.user2 : match.user1;
                
                let submissionId: string | null = null;
                let submittedAt: Date | null = null;
                
                if (isWinner) {
                    const matchHistory = await matchHistoryRepository.getAcceptedSubmissionForMatch(match.id, userId);
                    if (matchHistory && matchHistory.submission) {
                        submissionId = matchHistory.submission.id;
                        submittedAt = matchHistory.submission.submittedAt;
                    }
                }
                
                const opponentName = opponent.username || "";
                const problem : Problem | undefined = match.problem;
                const problemId = problem ? problem.id : "";
                const problemTitle = problem ? (problem.title || "") : "";
                
                data.push({
                    matchId: match.id,
                    opponentName,
                    problemId,
                    problemTitle,
                    result,
                    action,
                    submissionId,
                    submittedAt
                });
            }
            
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE,RESPONSE_MESSAGES.SUCCESS,data)
        } catch (error: any) {
            console.error(`[RecentMatchService] getRecentMatches error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE,RESPONSE_MESSAGES.SOMETHING_WENT_WRONG)
        }
    }
}

export const recentMatchService = new RecentMatchService();
