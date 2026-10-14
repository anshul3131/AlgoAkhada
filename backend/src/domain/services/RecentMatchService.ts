/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for fetching recent completed matches, submission links, and user match statistics
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { matchRepository, MatchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { matchHistoryRepository, MatchHistoryRepository } from "../../infrastructure/database/repositories/MatchHistoryRepository";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { MatchResult } from "../enums/MatchResult";
import { MatchAction } from "../enums/MatchAction";
import { RecentMatchDTO } from "../classes/RecentMatchDto";
import { Problem } from "../entities/Problem";
import { User } from "../entities/User";
import { RESPONSE_CODES, RESPONSE_MESSAGES, ResponseData } from "../classes/ResponseDTO";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";
import { cacheExpirySeconds } from "../../constants/CacheConstants";
import { DEFAULT_RECENT_MATCHES_LIMIT, EMPTY_STRING } from "../../constants/AppConstant";

@Service()
export class RecentMatchService {
    private matchRepository: MatchRepository;
    private matchHistoryRepository: MatchHistoryRepository;

    constructor() {
        this.matchRepository = matchRepository;
        this.matchHistoryRepository = matchHistoryRepository;
    }

    public async getRecentMatches(userId: string, limit: number = DEFAULT_RECENT_MATCHES_LIMIT): Promise<ResponseData> {
        try {
            const cacheKey = RedisKeys.getRecentMatchesKey(userId);
            
            // 1. Read-through Cache
            try {
                const cachedData = await redisCache.get<RecentMatchDTO[]>(cacheKey);
                if (cachedData) {
                    return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, cachedData);
                }
            } catch (cacheErr: any) {
                logger.warn(`[RecentMatchService] Redis get failed, falling back to DB: ${cacheErr.message}`);
            }

            // 2. Fetch matches using optimized partial indexes
            const matches = await this.matchRepository.getRecentCompletedMatches(userId, limit);

            // 3. Batch fetch accepted submissions to eliminate N+1 query
            const wonMatchIds = matches
                .filter(m => m.winner && m.winner.id === userId)
                .map(m => m.id);

            const acceptedHistories = await this.matchHistoryRepository.getAcceptedSubmissionsForMatches(wonMatchIds, userId);
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
                
                const opponentName = opponent ? (opponent.username || EMPTY_STRING) : EMPTY_STRING;
                const problem: Problem | undefined = match.problem;
                const problemId = problem ? problem.id : EMPTY_STRING;
                const problemTitle = problem ? (problem.title || EMPTY_STRING) : EMPTY_STRING;
                
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

            // 4. Populate cache with 2-hour TTL
            try {
                await redisCache.set(cacheKey, data, { EX: cacheExpirySeconds.TWO_HOURS });
            } catch (cacheErr: any) {
                logger.warn(`[RecentMatchService] Redis set failed: ${cacheErr.message}`);
            }
            
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'RecentMatchService', 'getRecentMatches', { userId, limit });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getUserStats(userId: string): Promise<ResponseData> {
        try {
            const stats = await this.matchRepository.getUserMatchStats(userId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, stats);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'RecentMatchService', 'getUserStats', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const recentMatchService = Container.get(RecentMatchService);
