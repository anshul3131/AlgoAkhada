import { matchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { matchHistoryRepository } from "../../infrastructure/database/repositories/MatchHistoryRepository";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { MatchResult } from "../enums/MatchResult";
import { MatchAction } from "../enums/MatchAction";
import { RecentMatchDTO } from "../classes/RecentMatchDto";
import { Problem } from "../entities/Problem";
import { User } from "../entities/User";
import { Response } from "express";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { RESPONSE_CODES, RESPONSE_MESSAGES, ResponseData } from "../classes/ResponseDTO";

export class RecentMatchService {
    public async getRecentMatches(userId: string, limit: number = 10, res?: Response): Promise<ResponseData> {
        try {
            const cacheKey = RedisKeys.getRecentMatchesKey(userId);
            
            // 1. Read-through Cache (2-hour TTL)
            try {
                const cachedData = await redisCache.get<RecentMatchDTO[]>(cacheKey);
                if (cachedData) {
                    return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, cachedData);
                }
            } catch (cacheErr: any) {
                console.warn(`[RecentMatchService] Redis get failed, falling back to DB: ${cacheErr.message}`);
            }

            // 2. Fetch matches using optimized partial indexes
            const matches = await matchRepository.getRecentCompletedMatches(userId, limit);

            // 3. Batch fetch accepted submissions to eliminate N+1 query
            const wonMatchIds = matches
                .filter(m => m.winner && m.winner.id === userId)
                .map(m => m.id);

            const acceptedHistories = await matchHistoryRepository.getAcceptedSubmissionsForMatches(wonMatchIds, userId);
            const submissionMap = new Map<string, { id: string; submittedAt: Date }>();
            for (const history of acceptedHistories) {
                if (history.match?.id && history.submission) {
                    submissionMap.set(history.match.id, {
                        id: history.submission.id,
                        submittedAt: history.submission.submittedAt
                    });
                }
            }
            
            const data: RecentMatchDTO[] = [];
            for (const match of matches) {
                const isWinner = match.winner && match.winner.id === userId;
                const result = isWinner ? MatchResult.WIN : MatchResult.LOSE;
                const action = isWinner ? MatchAction.VIEW_SOLUTION : MatchAction.UPSOLVE;
                
                const opponent: User = match.user1.id === userId ? match.user2 : match.user1;
                
                const acceptedSub = isWinner ? submissionMap.get(match.id) : null;
                const submissionId: string | null = acceptedSub ? acceptedSub.id : null;
                const submittedAt: Date | null = acceptedSub ? acceptedSub.submittedAt : null;
                
                const opponentName = opponent ? (opponent.username || "") : "";
                const problem: Problem | undefined = match.problem;
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

            // 4. Populate cache with 2-hour TTL (7200 seconds)
            try {
                await redisCache.set(cacheKey, data, { EX: 7200 });
            } catch (cacheErr: any) {
                console.warn(`[RecentMatchService] Redis set failed: ${cacheErr.message}`);
            }
            
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[RecentMatchService] getRecentMatches error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getUserStats(userId: string): Promise<ResponseData> {
        try {
            const stats = await matchRepository.getUserMatchStats(userId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, stats);
        } catch (error: any) {
            console.error(`[RecentMatchService] getUserStats error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const recentMatchService = new RecentMatchService();
