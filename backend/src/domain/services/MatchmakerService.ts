import { redisClient } from "../../infrastructure/redis/RedisClient";
import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { matchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";

export class MatchmakerService {
    private readonly QUEUE_PREFIX = "matchmaking_queue:";
    private intervalId: NodeJS.Timeout | null = null;

    constructor() {}

    public startLoop() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => this.processQueues(), 2000); // Check every 2s
        console.log("✅ Matchmaker loop started.");
    }

    public stopLoop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public async addToQueue(userId: string, elo: number, tag?: string) {
        const timestamp = Date.now();
        const activeTag = tag || "GENERIC";
        const queueKey = `${this.QUEUE_PREFIX}${activeTag}`;

        await redisClient.client.zAdd(queueKey, { score: elo, value: userId });
        await redisClient.client.hSet("queue_join_time", userId, timestamp.toString());
        await redisClient.client.hSet("user_active_queue", userId, queueKey);
        console.log(`User ${userId} (Elo: ${elo}) joined the queue [${activeTag}].`);
    }

    public async removeFromQueue(userId: string) {
        const queueKey = await redisClient.client.hGet("user_active_queue", userId);
        if (queueKey) {
            await redisClient.client.zRem(queueKey, userId);
            await redisClient.client.hDel("user_active_queue", userId);
        }
        await redisClient.client.hDel("queue_join_time", userId);
    }

    private async processQueues() {
        const now = Date.now();
        
        // Find all active matchmaking queues
        const queueKeys = await redisClient.client.keys(`${this.QUEUE_PREFIX}*`);

        for (const queueKey of queueKeys) {
            const tag = queueKey.replace(this.QUEUE_PREFIX, "");
            const usersInQueue = await redisClient.client.zRangeWithScores(queueKey, 0, -1);
            
            if (usersInQueue.length < 2) continue; // Need at least 2 players in this tag queue

            const processedUsers = new Set<string>();

            for (const user of usersInQueue) {
                if (processedUsers.has(user.value)) continue;

                const joinTimeStr = await redisClient.client.hGet("queue_join_time", user.value);
                if (!joinTimeStr) continue;

                const joinTime = parseInt(joinTimeStr);
                const waitTimeSec = Math.floor((now - joinTime) / 1000);
                const expansion = waitTimeSec * 10; // Expand bounds by 10 Elo every second
                
                const minElo = user.score - expansion;
                const maxElo = user.score + expansion;

                // Find candidates in range, excluding self
                const candidates = await redisClient.client.zRangeByScoreWithScores(queueKey, minElo, maxElo);
                const validCandidates = candidates.filter(c => c.value !== user.value && !processedUsers.has(c.value));

                if (validCandidates.length > 0 && validCandidates[0]) {
                    // Pick the closest match by Elo diff
                    let bestMatch = validCandidates[0];
                    let minDiff = Math.abs(bestMatch.score - user.score);
                    
                    for (const candidate of validCandidates) {
                        const diff = Math.abs(candidate.score - user.score);
                        if (diff < minDiff) {
                            minDiff = diff;
                            bestMatch = candidate;
                        }
                    }

                    // Match found!
                    await this.createMatch(user.value, bestMatch.value, tag);
                    
                    // Remove from queue
                    await this.removeFromQueue(user.value);
                    await this.removeFromQueue(bestMatch.value);
                    
                    processedUsers.add(user.value);
                    processedUsers.add(bestMatch.value);
                }
            }
        }
    }

    public async createMatch(user1Id: string, user2Id: string, tag: string) {
        console.log(`🎉 Match found: ${user1Id} vs ${user2Id} in tag: ${tag}`);

        const user1 = await userRepository.findOne({ where: { id: user1Id } });
        const user2 = await userRepository.findOne({ where: { id: user2Id } });

        if (!user1 || !user2) return;

        // Fetch medium problems with the specific tag
        const problemTag = tag === "GENERIC" ? undefined : tag;
        const problemData = await problemRepository.getAllProblems(1, 50, "Medium", undefined, problemTag);
        const problems = problemData.problems;
        
        if (problems.length === 0) {
            console.error(`No problems available for match in tag: ${tag}`);
            return;
        }
        const problem = problems[Math.floor(Math.random() * problems.length)]!;

        const match = matchRepository.create({
            user1,
            user2,
            problem
        });

        await matchRepository.save(match);

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
    }
}

export const matchmakerService = new MatchmakerService();
