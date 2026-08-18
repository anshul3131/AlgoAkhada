import { Repository, QueryRunner } from "typeorm";
import { Match } from "../../../domain/entities/Match";
import { AppDataSource } from "../data_source";
import { MatchStatus } from "../../../domain/enums/MatchStatus";

export class MatchRepository extends Repository<Match> {
    constructor() {
        super(Match, AppDataSource.createEntityManager());
    }

    async saveEntity(match: Match, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(Match).save(match);
        }
        return await this.save(match);
    }

    async getRecentCompletedMatches(userId: string, limit: number): Promise<Match[]> {
        return await this.find({
            where: [
                { user1: { id: userId }, status: MatchStatus.FINISHED },
                { user2: { id: userId }, status: MatchStatus.FINISHED }
            ],
            relations: {user1 : true,user2 : true,problem : true,winner : true},
            order: { created_at: "DESC" },
            take: limit
        });
    }

    async getUserMatchStats(userId: string): Promise<{ wins: number, losses: number }> {
        const matches = await this.find({
            where: [
                { user1: { id: userId }, status: MatchStatus.FINISHED },
                { user2: { id: userId }, status: MatchStatus.FINISHED }
            ],
            relations: { winner: true }
        });

        let wins = 0;
        let losses = 0;

        for (const match of matches) {
            if (match.winner && match.winner.id === userId) {
                wins++;
            } else if (match.winner && match.winner.id !== userId) {
                losses++;
            }
        }

        return { wins, losses };
    }
}

export const matchRepository = new MatchRepository();
