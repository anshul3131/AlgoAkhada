/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for custom lobby lifecycle (creation, rule configuration, join/leave concurrency, forfeit, start)
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { userRepository, UserRepository } from "../../infrastructure/database/repositories/UserRepository";
import { customMatchRepository, CustomMatchRepository } from "../../infrastructure/database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository, CustomMatchParticipantRepository } from "../../infrastructure/database/repositories/CustomMatchParticipantRepository";
import { problemRepository, ProblemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { CustomMatch } from "../entities/CustomMatch";
import { MatchStatus } from "../enums/MatchStatus";
import { CustomParticipantStatus } from "../enums/CustomParticipantStatus";
import { CustomMatchDTO } from "../classes/CustomMatchDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { redisCache } from "../../infrastructure/redis/RedisCache";
import { RedisKeys } from "../../infrastructure/redis/RedisConstants";
import { PublicLobbyDTO } from "../classes/PublicLobbyDTO";
import { AppDataSource } from "../../infrastructure/database/data_source";
import { CustomMatchParticipant } from "../entities/CustomMatchParticipant";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { logger } from "../../utils/LogglyClient";
import { cacheExpirySeconds } from "../../constants/CacheConstants";

const DEFAULT_LOBBY_NAME = "Custom Match";
const DEFAULT_LOBBY_DIFFICULTY = "Medium";
const MIN_JOIN_CODE = 100000;
const JOIN_CODE_RANGE = 900000;

@Service()
export class CustomMatchService {
    private userRepository: UserRepository;
    private customMatchRepository: CustomMatchRepository;
    private customMatchParticipantRepository: CustomMatchParticipantRepository;
    private problemRepository: ProblemRepository;

    constructor() {
        this.userRepository = userRepository;
        this.customMatchRepository = customMatchRepository;
        this.customMatchParticipantRepository = customMatchParticipantRepository;
        this.problemRepository = problemRepository;
    }

    public async createLobby(
        hostId: string, 
        topic: string, 
        timeLimit: number, 
        maxParticipants: number, 
        name: string = DEFAULT_LOBBY_NAME, 
        difficulty: string = DEFAULT_LOBBY_DIFFICULTY, 
        isPublic: boolean = false
    ): Promise<ResponseData> {
        try {
            const host = await this.userRepository.getUserById(hostId);
            if (!host) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.HOST_NOT_FOUND);

            const joinCode = Math.floor(MIN_JOIN_CODE + Math.random() * JOIN_CODE_RANGE).toString();
            const customMatchData = this.customMatchRepository.create({
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

            const savedMatch = await this.customMatchRepository.saveEntity(customMatchData);

            const hostParticipant = this.customMatchParticipantRepository.create({
                customMatch: savedMatch,
                user: host,
                status: CustomParticipantStatus.JOINED
            });
            await this.customMatchParticipantRepository.saveEntity(hostParticipant);

            if (isPublic) {
                try {
                    await redisCache.del(RedisKeys.getPublicLobbiesKey());
                } catch (cacheErr: any) {
                    logger.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
                }
            }

            const payload = await this.getLobbyDTO(savedMatch.id, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'createLobby', { hostId, topic });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async updateLobby(matchId: string, userId: string, data: { topic?: string, timeLimit?: number, maxParticipants?: number, isPublic?: boolean }): Promise<ResponseData> {
        try {
            const match = await this.customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            if (match.host?.id !== userId) return ResponseData.build(RESPONSE_CODES.UNAUTHORIZED, "Only host can update rules");
            if (match.status !== MatchStatus.NOT_STARTED) return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Cannot update rules after match started");

            if (data.topic) match.topic = data.topic;
            if (data.timeLimit) match.timeLimit = data.timeLimit;
            if (data.maxParticipants) match.maxParticipants = data.maxParticipants;
            if (data.isPublic !== undefined) match.isPublic = data.isPublic;

            await this.customMatchRepository.saveEntity(match);

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'updateLobby', { matchId, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async joinLobby(matchId: string, userId: string): Promise<ResponseData> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Pessimistic write lock prevents concurrent over-filling and races with leaveLobby
            // Must NOT include relations here because PostgreSQL disallows FOR UPDATE on nullable sides of outer joins
            const match = await queryRunner.manager.findOne(CustomMatch, {
                where: { id: matchId },
                lock: { mode: "pessimistic_write" }
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

            const user = await this.userRepository.getUserById(userId);
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
                logger.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'joinLobby', { matchId, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        } finally {
            await queryRunner.release();
        }
    }

    public async joinLobbyByCode(joinCode: string, userId: string): Promise<ResponseData> {
        try {
            const match = await this.customMatchRepository.getMatchByCode(joinCode);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, "Lobby not found for this code");
            return await this.joinLobby(match.id, userId);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'joinLobbyByCode', { joinCode, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async leaveLobby(matchId: string, userId: string): Promise<ResponseData> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Lock custom_matches row directly without outer join relations (avoids Postgres outer join FOR UPDATE error)
            const match = await queryRunner.manager.findOne(CustomMatch, {
                where: { id: matchId },
                lock: { mode: "pessimistic_write" }
            });

            if (!match) {
                await queryRunner.rollbackTransaction();
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            }

            // Fetch host relation separately under the lock protection without FOR UPDATE
            const fullMatch = await queryRunner.manager.findOne(CustomMatch, {
                where: { id: matchId },
                relations: { host: true }
            });

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
            if (fullMatch?.host?.id === userId && remainingParticipants.length > 0) {
                fullMatch.host = remainingParticipants[0]!.user;
                await queryRunner.manager.save(fullMatch);
            } else if (remainingParticipants.length === 0) {
                match.status = MatchStatus.ABORTED;
                await queryRunner.manager.save(match);
                isAborted = true;
            }

            await queryRunner.commitTransaction();

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            if (isAborted) {
                try {
                    await redisCache.del(RedisKeys.getCustomLobbyKey(matchId));
                } catch (cacheErr: any) {
                    logger.warn(`[CustomMatchService] Failed to delete custom lobby cache: ${cacheErr.message}`);
                }
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            await queryRunner.rollbackTransaction();
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'leaveLobby', { matchId, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        } finally {
            await queryRunner.release();
        }
    }

    public async forfeitMatch(matchId: string, userId: string): Promise<ResponseData> {
        try {
            const match = await this.customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);

            const participant = match.participants?.find(p => p.user.id === userId);
            if (participant) {
                participant.status = CustomParticipantStatus.FORFEITED;
                await this.customMatchParticipantRepository.saveEntity(participant);
                await this.getLobbyDTO(matchId, true);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, null);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'forfeitMatch', { matchId, userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async startMatch(matchId: string, hostId: string): Promise<ResponseData> {
        try {
            const match = await this.customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            if (match.host?.id !== hostId) return ResponseData.build(RESPONSE_CODES.UNAUTHORIZED, RESPONSE_MESSAGES.ONLY_HOST_CAN_START);
            if (match.status !== MatchStatus.NOT_STARTED) return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.MATCH_ALREADY_STARTED);

            const randomProblem = await this.problemRepository.getRandomProblemByTopicAndDifficulty(match.topic, match.difficulty || DEFAULT_LOBBY_DIFFICULTY);

            if (!randomProblem) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.NO_PROBLEMS_FOUND_FOR_TOPIC);

            match.problem = randomProblem;
            match.status = MatchStatus.IN_PROGRESS;
            match.startedAt = new Date();
            await this.customMatchRepository.saveEntity(match);

            try {
                await redisCache.del(RedisKeys.getPublicLobbiesKey());
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Failed to invalidate public lobbies: ${cacheErr.message}`);
            }

            const payload = await this.getLobbyDTO(matchId, true);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'startMatch', { matchId, hostId });
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
                logger.warn(`[CustomMatchService] Redis get public lobbies failed: ${cacheErr.message}`);
            }

            const payloads = await this.customMatchRepository.getPublicLobbies();

            try {
                await redisCache.set(cacheKey, payloads, { EX: cacheExpirySeconds.TEN_SECONDS });
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Redis set public lobbies failed: ${cacheErr.message}`);
            }

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payloads);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'CustomMatchService', 'getPublicLobbies');
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
                logger.warn(`[CustomMatchService] Redis get lobby failed: ${cacheErr.message}`);
            }
        }

        const match = await this.customMatchRepository.getMatchById(matchId);
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
                await redisCache.set(cacheKey, dto, { EX: cacheExpirySeconds.TEN_MINUTES });
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Redis set lobby failed: ${cacheErr.message}`);
            }
        } else {
            try {
                await redisCache.del(cacheKey);
            } catch (cacheErr: any) {
                logger.warn(`[CustomMatchService] Redis del lobby failed: ${cacheErr.message}`);
            }
        }

        return dto;
    }
}

export const customMatchService = Container.get(CustomMatchService);
