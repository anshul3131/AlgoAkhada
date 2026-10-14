/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for aggregating user dashboard metrics, live spectate matches, and home-screen bundle
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { Submission } from "../entities/Submission";
import { Match } from "../entities/Match";
import { MatchStatus } from "../enums/MatchStatus";
import { ResponseData } from "../classes/ResponseDTO";
import { RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { matchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { LiveMatchDTO } from "../classes/LiveMatchesDTO";
import { HomeScreenDTO } from "../classes/HomeScreenDTO";
import { RecentMatchService } from "./RecentMatchService";
import { ProblemService } from "./ProblemService";
import { CustomMatchService } from "./CustomMatchService";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";
import { cacheExpirySeconds } from "../../constants/CacheConstants";
import { DEFAULT_RECENT_MATCHES_LIMIT } from "../../constants/AppConstant";

const LIVE_MATCHES_LIMIT = 20;
const DEFAULT_FALLBACK_ELO = 1200;
const ELO_APPROX_DELTA = 15;
const RECENT_DASHBOARD_MATCHES_LIMIT = 10;

@Service()
export class DashboardService {
    private recentMatchService: RecentMatchService;
    private problemService: ProblemService;
    private customMatchService: CustomMatchService;

    constructor() {
        this.recentMatchService = Container.get(RecentMatchService);
        this.problemService = Container.get(ProblemService);
        this.customMatchService = Container.get(CustomMatchService);
    }

    public async getDashboardStats(userId: string): Promise<ResponseData> {
        try {
            // 1. Submissions Stats
            const submissionRepo = AppDataSource.getRepository(Submission);
            const submissions = await submissionRepo.find({
                where: { user: { id: userId } },
                select: { status: true }
            });

            const submissionStats = {
                accepted: 0,
                wrongAnswer: 0,
                timeLimitExceeded: 0,
                runtimeError: 0,
                other: 0
            };

            for (const sub of submissions) {
                if (sub.status === "Accepted" as any) submissionStats.accepted++;
                else if (sub.status === "Wrong Answer" as any) submissionStats.wrongAnswer++;
                else if (sub.status === "Time Limit Exceeded" as any) submissionStats.timeLimitExceeded++;
                else if (sub.status === "Runtime Error" as any) submissionStats.runtimeError++;
                else submissionStats.other++;
            }

            // 2. Matches Stats and Elo History (Approximated from matches)
            const matchRepo = AppDataSource.getRepository(Match);
            const matches = await matchRepo.find({
                where: [
                    { user1: { id: userId }, status: MatchStatus.FINISHED },
                    { user2: { id: userId }, status: MatchStatus.FINISHED }
                ],
                relations: { winner: true, user1: true, user2: true, problem: true },
                order: { created_at: "DESC" }
            });

            let wins = 0;
            let losses = 0;
            const matchHistoryRaw = [];
            const recentMatches = [];

            for (const match of matches) {
                const isWinner = match.winner && match.winner.id === userId;
                if (isWinner) wins++;
                else losses++;

                matchHistoryRaw.push({
                    date: match.created_at,
                    isWin: isWinner
                });

                if (recentMatches.length < RECENT_DASHBOARD_MATCHES_LIMIT) {
                    const opponent = match.user1.id === userId ? match.user2 : match.user1;
                    recentMatches.push({
                        matchId: match.id,
                        date: match.created_at,
                        isWin: isWinner,
                        opponent: {
                            id: opponent.id,
                            username: opponent.username,
                            elo_rating: opponent.elo_rating
                        },
                        problem: {
                            id: match.problem?.id,
                            title: match.problem?.title
                        }
                    });
                }
            }

            // Get current user Elo to trace backwards
            const userRepo = AppDataSource.getRepository("users");
            const user: any = await userRepo.findOne({ where: { id: userId } });
            let currentElo = user ? user.elo_rating : DEFAULT_FALLBACK_ELO;

            const eloHistory = [];
            eloHistory.push({ date: new Date(), elo: currentElo });

            for (const m of matchHistoryRaw) {
                if (m.isWin) {
                    currentElo -= ELO_APPROX_DELTA;
                } else {
                    currentElo += ELO_APPROX_DELTA;
                }
                eloHistory.push({ date: m.date, elo: currentElo });
            }
            eloHistory.reverse();

            // 3. Accepted Topics
            const acceptedSubmissions = await submissionRepo.find({
                where: { user: { id: userId }, status: "Accepted" as any },
                relations: { problem: true }
            });

            const topicsStats: Record<string, number> = {};
            const processedProblems = new Set<string>();

            for (const sub of acceptedSubmissions) {
                if (sub.problem && !processedProblems.has(sub.problem.id)) {
                    processedProblems.add(sub.problem.id);
                    if (sub.problem.tags && Array.isArray(sub.problem.tags)) {
                        for (const tag of sub.problem.tags) {
                            const niceTag = tag.replace(/^TAG_/, '').replace(/_/g, ' ').toLowerCase();
                            topicsStats[niceTag] = (topicsStats[niceTag] || 0) + 1;
                        }
                    }
                }
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, {
                submissionStats,
                matchStats: { wins, losses },
                topicsStats,
                eloHistory,
                recentMatches,
                userProfile: user ? {
                    id: user.id,
                    username: user.username,
                    elo_rating: user.elo_rating,
                    max_elo_rating: user.max_elo_rating,
                    avatar_url: user.avatar_url,
                    created_at: user.created_at
                } : null
            });

        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'DashboardService', 'getDashboardStats', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getLiveMatches(): Promise<ResponseData> {
        try {
            const cacheKey = RedisKeys.getLiveMatchesKey();
            try {
                const cached = await redisCache.get<LiveMatchDTO[]>(cacheKey);
                if (cached) {
                    return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, cached);
                }
            } catch (cacheErr: any) {
                logger.warn(`[DashboardService] Redis get live matches failed, falling back to DB: ${cacheErr.message}`);
            }

            const liveMatches = await matchRepository.getLiveMatches(LIVE_MATCHES_LIMIT);

            const data: LiveMatchDTO[] = liveMatches.map(m => ({
                matchId: m.id,
                user1: { id: m.user1?.id, username: m.user1?.username, elo: m.user1?.elo_rating },
                user2: { id: m.user2?.id, username: m.user2?.username, elo: m.user2?.elo_rating },
                problemTitle: m.problem?.title,
                problemId: m.problem?.id,
                createdAt: m.created_at
            }));

            data.sort((a, b) => ((b.user1.elo || DEFAULT_FALLBACK_ELO) + (b.user2.elo || DEFAULT_FALLBACK_ELO)) - ((a.user1.elo || DEFAULT_FALLBACK_ELO) + (a.user2.elo || DEFAULT_FALLBACK_ELO)));

            try {
                await redisCache.set(cacheKey, data, { EX: cacheExpirySeconds.TEN_SECONDS });
            } catch (cacheErr: any) {
                logger.warn(`[DashboardService] Redis set live matches failed: ${cacheErr.message}`);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'DashboardService', 'getLiveMatches');
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getHomeScreenData(userId: string): Promise<ResponseData> {
        try {
            const [recentMatchesRes, userStatsRes, tagsRes, liveMatchesRes, publicLobbiesRes] = await Promise.all([
                this.recentMatchService.getRecentMatches(userId, DEFAULT_RECENT_MATCHES_LIMIT),
                this.recentMatchService.getUserStats(userId),
                this.problemService.getTags(),
                this.getLiveMatches(),
                this.customMatchService.getPublicLobbies()
            ]);

            const homeData: HomeScreenDTO = {
                recentMatches: (recentMatchesRes.data as any) || [],
                stats: (userStatsRes.data as any) || { wins: 0, losses: 0 },
                tags: (tagsRes.data as any)?.tags || [],
                liveMatches: (liveMatchesRes.data as any) || [],
                publicLobbies: (publicLobbiesRes.data as any) || []
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, homeData);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'DashboardService', 'getHomeScreenData', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const dashboardService = Container.get(DashboardService);
