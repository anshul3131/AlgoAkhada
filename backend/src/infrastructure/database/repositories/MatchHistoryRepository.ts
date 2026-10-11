import { Repository, QueryRunner, In } from "typeorm";
import { MatchHistory } from "../../../domain/entities/MatchHistory";
import { AppDataSource } from "../data_source";
import { SubmissionStatus } from "../../../domain/entities/Submission";

export class MatchHistoryRepository extends Repository<MatchHistory> {
    constructor() {
        super(MatchHistory, AppDataSource.createEntityManager());
    }

    async saveEntity(history: MatchHistory, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(MatchHistory).save(history);
        }
        return await this.save(history);
    }

    async getAcceptedSubmissionForMatch(matchId: string, userId: string): Promise<MatchHistory | null> {
        return await this.findOne({
            where: {
                match: { id: matchId },
                user: { id: userId },
                submission: { status: SubmissionStatus.ACCEPTED }
            },
            relations: {submission : true}
        });
    }

    async getAcceptedSubmissionsForMatches(matchIds: string[], userId: string): Promise<MatchHistory[]> {
        if (!matchIds || matchIds.length === 0) return [];
        return await this.find({
            where: {
                match: { id: In(matchIds) },
                user: { id: userId },
                submission: { status: SubmissionStatus.ACCEPTED }
            },
            relations: { match: true, submission: true }
        });
    }
}

export const matchHistoryRepository = new MatchHistoryRepository();
