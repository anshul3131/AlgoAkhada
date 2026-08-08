import { kafkaProducerClient } from "../../infrastructure/kafka/KafkaProducerClient";
import { matchRepository } from "../../infrastructure/database/repositories/MatchRepository";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { Match } from "../entities/Match";
import { MatchStatus } from "../enums/MatchStatus";

export class MatchService {
    
    public async getActiveMatchForUser(userId: string): Promise<Match | null> {
        return await matchRepository.findOne({
            where: [
                { user1: { id: userId }, status: MatchStatus.IN_PROGRESS },
                { user2: { id: userId }, status: MatchStatus.IN_PROGRESS }
            ],
            relations: { user1: true, user2: true, problem: true }
        });
    }  

    public async updateOpponentStatus(matchId: string, userId: string, statusData: any) {
        const payload = {
            type: 'opponent_status',
            payload: {
                matchId,
                userId, // The user whose status is being updated
                status: statusData
            }
        };
        await kafkaProducerClient.sendMessage("match-events", payload);
    }

    public async finishMatch(matchId: string, winnerId: string) {
        const match = await matchRepository.findOne({ 
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
        await matchRepository.save(match);


        // Calculate ELO
        const kFactor = 32;
        const expectedScoreWinner = 1 / (1 + Math.pow(10, (loser.elo_rating - winner.elo_rating) / 400));
        const expectedScoreLoser = 1 / (1 + Math.pow(10, (winner.elo_rating - loser.elo_rating) / 400));

        const newWinnerElo = Math.round(winner.elo_rating + kFactor * (1 - expectedScoreWinner));
        const newLoserElo = Math.round(loser.elo_rating + kFactor * (0 - expectedScoreLoser));

        winner.elo_rating = newWinnerElo;
        loser.elo_rating = newLoserElo;

        await userRepository.save(winner);
        await userRepository.save(loser);

        // Send match result event
        const matchResultPayload = {
            type: 'match_result',
            payload: {
                matchId,
                winnerId,
                loserId
            }
        };
        await kafkaProducerClient.sendMessage("match-events", matchResultPayload);

        // Send ELO update events
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
    }

    public async finishMatchByTimeout(matchId: string, loserId: string) {
        const match = await matchRepository.findOne({
            where: { id: matchId },
            relations: { user1: true, user2: true }
        });

        if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

        const isParticipant = match.user1.id === loserId || match.user2.id === loserId;
        if (!isParticipant) return;

        const winnerId = match.user1.id === loserId ? match.user2.id : match.user1.id;
        await this.finishMatch(matchId, winnerId);
    }
}

export const matchService = new MatchService();
