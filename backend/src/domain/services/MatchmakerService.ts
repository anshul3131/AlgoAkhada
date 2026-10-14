/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for automated Redis-backed matchmaking loop with dynamic Elo range expansion
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { matchRepository, MatchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { problemRepository, ProblemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { userRepository, UserRepository } from "../../infrastructure/database/repositories/UserRepository";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";
import { _SECOND_MS } from "../../constants/AppConstant";

const LOOP_INTERVAL_MS = 2000;
const ELO_EXPANSION_RATE_PER_SEC = 10;
const MATCHMAKER_SEARCH_POOL_SIZE = 50;
const DEFAULT_MATCH_DIFFICULTY = "Medium";

@Service()
export class MatchmakerService {
    private readonly QUEUE_PREFIX = "matchmaking_queue:";
    private intervalId: NodeJS.Timeout | null = null;
    private matchRepository: MatchRepository;
    private problemRepository: ProblemRepository;
    private userRepository: UserRepository;

    constructor() {
        this.matchRepository = matchRepository;
        this.problemRepository = problemRepository;
        this.userRepository = userRepository;
    }

    public startLoop() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.processQueues(), LOOP_INTERVAL_MS);
        logger.info("✅ Matchmaker loop started.");
    }

    public stopLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public async addToQueue(userId: string, elo: number, tag?: string) {
        try {
            const timestamp = Date.now();
            const activeTag = tag || "GENERIC";
            const queueKey = RedisKeys.getMatchmakingQueueKey(activeTag);

            await redisCache.zadd(queueKey, elo, userId);
            await redisCache.hset(RedisKeys.getQueueJoinTimeKey(), userId, timestamp.toString());
            await redisCache.hset(RedisKeys.getUserActiveQueueKey(), userId, queueKey);
            logger.info(`User ${userId} (Elo: ${elo}) joined the queue [${activeTag}].`);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchmakerService', 'addToQueue', { userId, elo, tag });
        }
    }

    public async removeFromQueue(userId: string) {
        try {
            const queueKey = await redisCache.hget(RedisKeys.getUserActiveQueueKey(), userId);
            if (queueKey) {
                await redisCache.zrem(queueKey, userId);
                await redisCache.hdel(RedisKeys.getUserActiveQueueKey(), userId);
            }
            await redisCache.hdel(RedisKeys.getQueueJoinTimeKey(), userId);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchmakerService', 'removeFromQueue', { userId });
        }
    }

    private async processQueues() {
        try {
            const now = Date.now();
            const queueKeys = await redisCache.keys(RedisKeys.getMatchmakingQueuePattern());

            for (const queueKey of queueKeys) {
                const tag = queueKey.replace(this.QUEUE_PREFIX, "");
                const usersInQueue = await redisCache.zrangeWithScores(queueKey, 0, -1);
                
                if (usersInQueue.length < 2) continue;

                const processedUsers = new Set<string>();

                for (const user of usersInQueue) {
                    if (processedUsers.has(user.value)) continue;

                    const joinTimeStr = await redisCache.hget(RedisKeys.getQueueJoinTimeKey(), user.value);
                    if (!joinTimeStr) continue;

                    const joinTime = parseInt(joinTimeStr);
                    const waitTimeSec = Math.floor((now - joinTime) / _SECOND_MS);
                    const expansion = waitTimeSec * ELO_EXPANSION_RATE_PER_SEC;
                    
                    const minElo = user.score - expansion;
                    const maxElo = user.score + expansion;

                    const candidates = await redisCache.zrangeByScoreWithScores(queueKey, minElo, maxElo);
                    const validCandidates = candidates.filter(c => c.value !== user.value && !processedUsers.has(c.value));

                    if (validCandidates.length > 0 && validCandidates[0]) {
                        let bestMatch = validCandidates[0];
                        let minDiff = Math.abs(bestMatch.score - user.score);
                        
                        for (const candidate of validCandidates) {
                            const diff = Math.abs(candidate.score - user.score);
                            if (diff < minDiff) {
                                minDiff = diff;
                                bestMatch = candidate;
                            }
                        }

                        await this.createMatch(user.value, bestMatch.value, tag);
                        
                        await this.removeFromQueue(user.value);
                        await this.removeFromQueue(bestMatch.value);
                        
                        processedUsers.add(user.value);
                        processedUsers.add(bestMatch.value);
                    }
                }
            }
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchmakerService', 'processQueues');
        }
    }

    public async createMatch(user1Id: string, user2Id: string, tag: string) {
        try {
            logger.info(`Match found: ${user1Id} vs ${user2Id} in tag: ${tag}`);

            const user1 = await this.userRepository.findOne({ where: { id: user1Id } });
            const user2 = await this.userRepository.findOne({ where: { id: user2Id } });

            if (!user1 || !user2) return;

            const problemTag = tag === "GENERIC" ? undefined : tag;
            const problemData = await this.problemRepository.getAllProblems(1, MATCHMAKER_SEARCH_POOL_SIZE, DEFAULT_MATCH_DIFFICULTY, undefined, problemTag);
            const problems = problemData.problems;
            
            if (problems.length === 0) {
                logger.error(`No problems available for match in tag: ${tag}`);
                return;
            }
            const problem = problems[Math.floor(Math.random() * problems.length)]!;

            const match = this.matchRepository.create({
                user1,
                user2,
                problem
            });

            await this.matchRepository.save(match);

            try {
                await redisCache.del(RedisKeys.getLiveMatchesKey());
            } catch (cacheErr: any) {
                logger.warn(`[MatchmakerService] Failed to invalidate live matches cache: ${cacheErr.message}`);
            }

            const matchPayload = {
                type: 'match_found',
                payload: {
                    matchId: match.id,
                    user1Id: user1.id,
                    user2Id: user2.id,
                    problemId: problem.id,
                    startTime: new Date().toISOString()
                }
            };

            await kafkaProducerClient.sendMessage("matchmaking-events", matchPayload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'MatchmakerService', 'createMatch', { user1Id, user2Id, tag });
        }
    }
}

export const matchmakerService = Container.get(MatchmakerService);
