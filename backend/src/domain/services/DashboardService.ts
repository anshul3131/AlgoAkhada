import { AppDataSource } from "../../infrastructure/database/data_source";
import { Submission } from "../entities/Submission";
import { Match } from "../entities/Match";
import { Problem } from "../entities/Problem";
import { MatchStatus } from "../enums/MatchStatus";
import { ResponseData } from "../classes/ResponseDTO";
import { RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";

class DashboardService {
    public async getDashboardStats(userId: string): Promise<ResponseData> {
        try {
            // 1. Submissions Stats
            const submissionRepo = AppDataSource.getRepository(Submission);
            const submissions = await submissionRepo.find({
                where: { user: { id: userId } },
                select: {status : true}
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

            // 2. Matches Stats and 4. Elo History (Approximated from matches)
            const matchRepo = AppDataSource.getRepository(Match);
            const matches = await matchRepo.find({
                where: [
                    { user1: { id: userId }, status: MatchStatus.FINISHED },
                    { user2: { id: userId }, status: MatchStatus.FINISHED }
                ],
                relations: {winner : true, user1: true, user2: true, problem: true},
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

                if (recentMatches.length < 10) {
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
            let currentElo = user ? user.elo_rating : 1200;

            const eloHistory = [];
            // We push the current state
            eloHistory.push({ date: new Date(), elo: currentElo });

            // Trace backwards
            for (const m of matchHistoryRaw) {
                if (m.isWin) {
                    currentElo -= 15; // approximate back-calculation
                } else {
                    currentElo += 15;
                }
                eloHistory.push({ date: m.date, elo: currentElo });
            }
            eloHistory.reverse(); // chronological order

            // 3. Accepted Topics
            // Get all accepted submissions with problems and tags
            const acceptedSubmissions = await submissionRepo.find({
                where: { user: { id: userId }, status: "Accepted" as any },
                relations: {problem : true}
            });

            const topicsStats: Record<string, number> = {};
            const processedProblems = new Set<string>();

            for (const sub of acceptedSubmissions) {
                if (sub.problem && !processedProblems.has(sub.problem.id)) {
                    processedProblems.add(sub.problem.id);
                    if (sub.problem.tags && Array.isArray(sub.problem.tags)) {
                        for (const tag of sub.problem.tags) {
                            // Strip TAG_ prefix if exists
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
            console.error(`[DashboardService] error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
    public async getLiveMatches(): Promise<ResponseData> {
        try {
            const matchRepo = AppDataSource.getRepository(Match);
            const liveMatches = await matchRepo.find({
                where: { status: MatchStatus.IN_PROGRESS },
                relations: { user1: true, user2: true, problem: true },
                order: { created_at: "DESC" },
                take: 20
            });

            // Map to a clean DTO
            const data = liveMatches.map(m => ({
                matchId: m.id,
                user1: { id: m.user1?.id, username: m.user1?.username, elo: m.user1?.elo_rating },
                user2: { id: m.user2?.id, username: m.user2?.username, elo: m.user2?.elo_rating },
                problemTitle: m.problem?.title,
                problemId: m.problem?.id,
                createdAt: m.created_at
            }));

            // Sort by combined elo rating
            data.sort((a, b) => ((b.user1.elo || 1200) + (b.user2.elo || 1200)) - ((a.user1.elo || 1200) + (a.user2.elo || 1200)));

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[DashboardService] getLiveMatches error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const dashboardService = new DashboardService();
