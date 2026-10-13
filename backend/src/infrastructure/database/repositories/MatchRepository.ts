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

    async getLiveMatches(limit: number = 20): Promise<Match[]> {
        return await this.find({
            where: { status: MatchStatus.IN_PROGRESS },
            relations: { user1: true, user2: true, problem: true },
            order: { created_at: "DESC" },
            take: limit
        });
    }

    async getUserMatchStats(userId: string): Promise<{ wins: number, losses: number }> {
        const result = await this.query(
            `SELECT 
                COUNT(CASE WHEN winner_id = $1 THEN 1 END)::int AS wins,
                COUNT(CASE WHEN winner_id IS NOT NULL AND winner_id != $1 THEN 1 END)::int AS losses
             FROM matches
             WHERE (user1_id = $1 OR user2_id = $1)
               AND status = $2`,
            [userId, MatchStatus.FINISHED]
        );

        if (result && result.length > 0) {
            return {
                wins: Number(result[0].wins) || 0,
                losses: Number(result[0].losses) || 0
            };
        }

        return { wins: 0, losses: 0 };
    }
}

export const matchRepository = new MatchRepository();
