import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { customMatchRepository } from "../../infrastructure/database/repositories/CustomMatchRepository";
import { customMatchParticipantRepository } from "../../infrastructure/database/repositories/CustomMatchParticipantRepository";
import { problemRepository } from "../../infrastructure/database/repositories/ProblemRepository";
import { CustomMatch } from "../entities/CustomMatch";
import { MatchStatus } from "../enums/MatchStatus";
import { CustomParticipantStatus } from "../enums/CustomParticipantStatus";
import { CustomMatchDTO, CustomParticipantDTO } from "../classes/CustomMatchDTO";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";

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

            const payload = await this.getLobbyDTO(savedMatch.id);
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

            const payload = await this.getLobbyDTO(matchId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] updateLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async joinLobby(matchId: string, userId: string): Promise<ResponseData> {
        try {
            const match = await customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);
            const user = await userRepository.getUserById(userId);
            if (!user) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.USER_NOT_FOUND);

            const existingParticipant = match.participants?.find(p => p.user.id === userId);
            
            if (!existingParticipant && match.status !== MatchStatus.NOT_STARTED) return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.MATCH_ALREADY_STARTED);

            if (!existingParticipant && match.participants && match.participants.length >= match.maxParticipants) {
                return ResponseData.build(RESPONSE_CODES.INVALID_INPUT, "Lobby is full");
            }
            if (!existingParticipant) {
                const participant = customMatchParticipantRepository.create({
                    customMatch: match,
                    user,
                    status: CustomParticipantStatus.JOINED
                });
                await customMatchParticipantRepository.saveEntity(participant);
            }

            const payload = await this.getLobbyDTO(matchId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] joinLobby error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
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
        try {
            const match = await customMatchRepository.getMatchById(matchId);
            if (!match) return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND);

            const participantToRemove = match.participants?.find(p => p.user.id === userId);
            if (participantToRemove) {
                await customMatchParticipantRepository.delete(participantToRemove.id);
            }

            match.participants = match.participants?.filter(p => p.user.id !== userId);

            if (match.host?.id === userId && match.participants && match.participants.length > 0) {
                match.host = match.participants[0]!.user;
                await customMatchRepository.saveEntity(match);
            } else if (match.participants?.length === 0) {
                match.status = MatchStatus.ABORTED;
                await customMatchRepository.saveEntity(match);
            }

            const payload = await this.getLobbyDTO(matchId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error) {
            console.error(error);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
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

            const payload = await this.getLobbyDTO(matchId);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[CustomMatchService] startMatch error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getPublicLobbies(): Promise<ResponseData> {
        try {
            const matches = await customMatchRepository.getPublicLobbies();
            const payloads = matches.map(match => ({
                id: match.id,
                hostId: match.host?.id,
                hostUsername: match.host?.username,
                timeLimit: match.timeLimit,
                maxParticipants: match.maxParticipants,
                joinCode: match.joinCode,
                topic: match.topic,
                name: match.name,
                difficulty: match.difficulty,
                participantCount: match.participants?.length || 0
            }));
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payloads);
        } catch (error: any) {
            console.error('[CustomMatchService] getPublicLobbies error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getLobbyDTO(matchId: string): Promise<CustomMatchDTO | null> {
        const match = await customMatchRepository.getMatchById(matchId);
        if (!match) return null;

        return {
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
    }
}

export const customMatchService = new CustomMatchService();
