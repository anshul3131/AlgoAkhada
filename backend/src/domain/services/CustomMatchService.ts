import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { customMatchRepository } from "../../infrastructure/database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository } from "../../infrastructure/database/repositories/CustomMatchParticipantRepository";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { CustomMatch } from "../entities/CustomMatch";
import { MatchStatus } from "../enums/MatchStatus";
import { CustomParticipantStatus } from "../enums/CustomParticipantStatus";
import { CustomMatchDTO, CustomParticipantDTO } from "../classes/CustomMatchDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { PublicLobbyDTO } from "../classes/PublicLobbyDTO";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { CustomMatchParticipant } from "../entities/CustomMatchParticipant";

export class CustomMatchService {

    public async createLobby(hostId: string, topic: string, timeLimit: number, maxParticipants: number, name: string = "Custom Match", difficulty: string = "Medium", isPublic: boolean = false): Promise<ResponseData> {
        try {
            const host = await userRepository.getUserById(hostId);
            if (!host) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.HOST_NOT_FOUND);

            const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
            const customMatchData = customMatchRepository.create({
                host,
                topic,
                timeLimit,
                maxParticipants,
                joinCode,
                name,
                difficulty,
                isPublic,
                status: MatchStatus.NOT_STARTED
            });

            const savedMatch = await customMatchRepository.saveEntity(customMatchData);

            // Add host as the first participant
            const hostParticipant = customMatchParticipantRepository.create({
                customMatch: savedMatch,
                user: host,
                status: CustomParticipantStatus.JOINED
            });
            await customMatchParticipantRepository.saveEntity(hostParticipant);

            if (isPublic) {
                try {
                    await redisCache.del(RedisKeys.getPublicLobbiesKey());
                } catch (cacheErr: any) {
                    console.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
                }
            }

            const payload = await this.getLobbyDTO(savedMatch.id, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] createLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async updateLobby(matchId: string, userId: string, data: { topic?: string, timeLimit?: number, maxParticipants?: number, isPublic?: boolean }): Promise<ResponseData> {
        try {
            const match = await customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            if (match.host?.id !== userId) return ResponseData.build(RESPONSE_CODES.UNAUTHORIZED, "Only host can update rules");
            if (match.status !== MatchStatus.NOT_STARTED) return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Cannot update rules after match started");

            if (data.topic) match.topic = data.topic;
            if (data.timeLimit) match.timeLimit = data.timeLimit;
            if (data.maxParticipants) match.maxParticipants = data.maxParticipants;
            if (data.isPublic !== undefined) match.isPublic = data.isPublic;

            await customMatchRepository.saveEntity(match);

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] updateLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async joinLobby(matchId: string, userId: string): Promise<ResponseData> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Pessimistic write lock prevents concurrent over-filling and races with leaveLobby
            const match = await queryRunner.manager.findOne(CustomMatch, {
                where: { id: matchId },
                lock: { mode: "pessimistic_write" },
                relations: { host: true, problem: true }
            });

            if (!match) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            }

            // Defensive Status Checks
            if (match.status === MatchStatus.ABORTED) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, "This lobby has been closed by the host.");
            }

            if (match.status === MatchStatus.IN_PROGRESS || match.status === MatchStatus.FINISHED) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "This match has already started.");
            }

            const user = await userRepository.getUserById(userId);
            if (!user) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.USER_NOT_FOUND);
            }

            const participants = await queryRunner.manager.find(CustomMatchParticipant, {
                where: { customMatch: { id: matchId } },
                relations: { user: true }
            });

            const existingParticipant = participants.find(p => p.user.id === userId);

            if (!existingParticipant && participants.length >= match.maxParticipants) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Lobby is full");
            }

            if (!existingParticipant) {
                const participant = queryRunner.manager.create(CustomMatchParticipant, {
                    customMatch: match,
                    user,
                    status: CustomParticipantStatus.JOINED
                });
                await queryRunner.manager.save(participant);
            }

            await queryRunner.commitTransaction();

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            console.error('[CustomMatchService] joinLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        } finally {
            await queryRunner.release();
        }
    }

    public async joinLobbyByCode(joinCode: string, userId: string): Promise<ResponseData> {
        try {
            const match = await customMatchRepository.getMatchByCode(joinCode);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, "Lobby not found for this code");
            return await this.joinLobby(match.id, userId);
        } catch (error: any) {
            console.error('[CustomMatchService] joinLobbyByCode error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async leaveLobby(matchId: string, userId: string): Promise<ResponseData> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Pessimistic write lock prevents concurrent joins during room teardown
            const match = await queryRunner.manager.findOne(CustomMatch, {
                where: { id: matchId },
                lock: { mode: "pessimistic_write" },
                relations: { host: true, problem: true }
            });

            if (!match) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            }

            const participants = await queryRunner.manager.find(CustomMatchParticipant, {
                where: { customMatch: { id: matchId } },
                relations: { user: true }
            });

            const participantToRemove = participants.find(p => p.user.id === userId);
            if (participantToRemove) {
                await queryRunner.manager.delete(CustomMatchParticipant, participantToRemove.id);
            }

            const remainingParticipants = participants.filter(p => p.user.id !== userId);

            let isAborted = false;
            if (match.host?.id === userId && remainingParticipants.length > 0) {
                match.host = remainingParticipants[0]!.user;
                await queryRunner.manager.save(match);
            } else if (remainingParticipants.length === 0) {
                match.status = MatchStatus.ABORTED;
                await queryRunner.manager.save(match);
                isAborted = true;
            }

            await queryRunner.commitTransaction();

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            if (isAborted) {
                try {
                    await redisCache.del(RedisKeys.getCustomLobbyKey(matchId));
                } catch (cacheErr: any) {
                    console.warn(`[CustomMatchService] Failed to delete custom lobby cache: ${cacheErr.message}`);
                }
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            console.error('[CustomMatchService] leaveLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        } finally {
            await queryRunner.release();
        }
    }

    public async forfeitMatch(matchId: string, userId: string): Promise<ResponseData> {
        try {
            const match = await customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);

            const participant = match.participants?.find(p => p.user.id === userId);
            if (participant) {
                participant.status = CustomParticipantStatus.FORFEITED;
                await customMatchParticipantRepository.saveEntity(participant);
                await this.getLobbyDTO(matchId, true);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, null);
        } catch (error) {
            console.error(error);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async startMatch(matchId: string, hostId: string): Promise<ResponseData> {
        try {
            const match = await customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            if (match.host?.id !== hostId) return ResponseData.build(RESPONSE_CODES.UNAUTHORIZED, RESPONSE_MESSAGES.ONLY_HOST_CAN_START);
            if (match.status !== MatchStatus.NOT_STARTED) return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.MATCH_ALREADY_STARTED);

            const randomProblem = await problemRepository.getRandomProblemByTopicAndDifficulty(match.topic, match.difficulty || 'Medium');

            if (!randomProblem) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NO_PROBLEMS_FOUND_FOR_TOPIC);

            match.problem = randomProblem;
            match.status = MatchStatus.IN_PROGRESS;
            match.startedAt = new Date();
            await customMatchRepository.saveEntity(match);

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] startMatch error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getPublicLobbies(): Promise<ResponseData> {
        try {
            const cacheKey = RedisKeys.getPublicLobbiesKey();
            try {
                const cached = await redisCache.get<PublicLobbyDTO[]>(cacheKey);
                if (cached) {
                    return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, cached);
                }
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Redis get public lobbies failed: ${cacheErr.message}`);
            }

            const payloads = await customMatchRepository.getPublicLobbies();

            try {
                await redisCache.set(cacheKey, payloads, { EX: 60 });
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Redis set public lobbies failed: ${cacheErr.message}`);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payloads);
        } catch (error: any) {
            console.error('[CustomMatchService] getPublicLobbies error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getLobbyDTO(matchId: string, skipCache: boolean = false): Promise<CustomMatchDTO | null> {
        const cacheKey = RedisKeys.getCustomLobbyKey(matchId);
        if (!skipCache) {
            try {
                const cached = await redisCache.get<CustomMatchDTO>(cacheKey);
                if (cached) {
                    return cached;
                }
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Redis get lobby failed: ${cacheErr.message}`);
            }
        }

        const match = await customMatchRepository.getMatchById(matchId);
        if (!match) return null;

        const dto: CustomMatchDTO = {
            id: match.id,
            hostId: match.host?.id,
            problemId: match.problem?.id,
            timeLimit: match.timeLimit,
            maxParticipants: match.maxParticipants,
            joinCode: match.joinCode,
            startedAt: match.startedAt?.toISOString(),
            topic: match.topic,
            name: match.name,
            difficulty: match.difficulty,
            isPublic: match.isPublic,
            status: match.status,
            participants: (match.participants || []).map(p => ({
                userId: p.user.id,
                username: p.user.username,
                status: p.status,
                score: p.score
            }))
        } as CustomMatchDTO;

        if (match.status === MatchStatus.NOT_STARTED || match.status === MatchStatus.IN_PROGRESS) {
            try {
                await redisCache.set(cacheKey, dto, { EX: 600 });
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Redis set lobby failed: ${cacheErr.message}`);
            }
        } else {
            try {
                await redisCache.del(cacheKey);
            } catch (cacheErr: any) {
                console.warn(`[CustomMatchService] Redis del lobby failed: ${cacheErr.message}`);
            }
        }

        return dto;
    }
}

export const customMatchService = new CustomMatchService();
