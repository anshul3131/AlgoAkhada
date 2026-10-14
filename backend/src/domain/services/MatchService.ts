/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for active ranked 1v1 match lifecycle, Elo rating calculations, and match outcome events
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { matchRepository, MatchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { userRepository, UserRepository } from "../../infrastructure/database/repositories/UserRepository";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { Match } from "../entities/Match";
import { MatchStatus } from "../enums/MatchStatus";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";

const ELO_K_FACTOR = 32;
const ELO_DIVISOR = 400;

@Service()
export class MatchService {
    private matchRepository: MatchRepository;
    private userRepository: UserRepository;

    constructor() {
        this.matchRepository = matchRepository;
        this.userRepository = userRepository;
    }
    
    public async getActiveMatchForUser(userId: string): Promise<Match | null> {
        try {
            return await this.matchRepository.findOne({
                where: [
                    { user1: { id: userId }, status: MatchStatus.IN_PROGRESS },
                    { user2: { id: userId }, status: MatchStatus.IN_PROGRESS }
                ],
                relations: { user1: true, user2: true, problem: true }
            });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchService', 'getActiveMatchForUser', { userId });
            return null;
        }
    }  

    public async updateOpponentStatus(matchId: string, userId: string, statusData: any): Promise<void> {
        try {
            const payload = {
                type: 'opponent_status',
                payload: {
                    matchId,
                    userId,
                    status: statusData
                }
            };
            await kafkaProducerClient.sendMessage("match-events", payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchService', 'updateOpponentStatus', { matchId, userId });
        }
    }

    public async finishMatch(matchId: string, winnerId: string): Promise<void> {
        try {
            const match = await this.matchRepository.findOne({ 
                where: { id: matchId },
                relations: { user1: true, user2: true }
            });

            if (!match || match.status !== MatchStatus.IN_PROGRESS) {
                return;
            }

            match.status = MatchStatus.FINISHED;
            
            const loserId = match.user1.id === winnerId ? match.user2.id : match.user1.id;
            
            const winner = match.user1.id === winnerId ? match.user1 : match.user2;
            const loser = match.user1.id === loserId ? match.user1 : match.user2;

            match.winner = winner;
            await this.matchRepository.save(match);

            // Invalidate recent matches and live matches cache
            try {
                await Promise.all([
                    redisCache.del(RedisKeys.getRecentMatchesKey(winnerId)),
                    redisCache.del(RedisKeys.getRecentMatchesKey(loserId)),
                    redisCache.del(RedisKeys.getLiveMatchesKey())
                ]);
            } catch (cacheErr: any) {
                logger.warn(`[MatchService] Failed to invalidate cache: ${cacheErr.message}`);
            }

            // Calculate ELO
            const expectedScoreWinner = 1 / (1 + Math.pow(10, (loser.elo_rating - winner.elo_rating) / ELO_DIVISOR));
            const expectedScoreLoser = 1 / (1 + Math.pow(10, (winner.elo_rating - loser.elo_rating) / ELO_DIVISOR));

            const newWinnerElo = Math.round(winner.elo_rating + ELO_K_FACTOR * (1 - expectedScoreWinner));
            const newLoserElo = Math.round(loser.elo_rating + ELO_K_FACTOR * (0 - expectedScoreLoser));

            winner.elo_rating = newWinnerElo;
            loser.elo_rating = newLoserElo;

            await this.userRepository.save(winner);
            await this.userRepository.save(loser);

            // Send match result and ELO update events
            const matchResultPayload = {
                type: 'match_result',
                payload: {
                    matchId,
                    winnerId,
                    loserId
                }
            };
            await kafkaProducerClient.sendMessage("match-events", matchResultPayload);

            const winnerEloPayload = {
                type: 'elo_update',
                payload: {
                    userId: winnerId,
                    newElo: newWinnerElo
                }
            };
            await kafkaProducerClient.sendMessage("match-events", winnerEloPayload);

            const loserEloPayload = {
                type: 'elo_update',
                payload: {
                    userId: loserId,
                    newElo: newLoserElo
                }
            };
            await kafkaProducerClient.sendMessage("match-events", loserEloPayload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchService', 'finishMatch', { matchId, winnerId });
        }
    }

    public async finishMatchByTimeout(matchId: string, loserId: string): Promise<void> {
        try {
            const match = await this.matchRepository.findOne({
                where: { id: matchId },
                relations: { user1: true, user2: true }
            });

            if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

            const isParticipant = match.user1.id === loserId || match.user2.id === loserId;
            if (!isParticipant) return;

            const winnerId = match.user1.id === loserId ? match.user2.id : match.user1.id;
            await this.finishMatch(matchId, winnerId);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchService', 'finishMatchByTimeout', { matchId, loserId });
        }
    }
}

export const matchService = Container.get(MatchService);
