/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for MatchHistory records connecting matches, users, and evaluated submissions
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner, In } from "typeorm";
import { Service } from "typedi";
import { MatchHistory } from "../../../domain/entities/MatchHistory";
import { AppDataSource } from "../data_source";
import { SubmissionStatus } from "../../../domain/entities/Submission";

@Service()
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
            relations: { submission: true }
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
