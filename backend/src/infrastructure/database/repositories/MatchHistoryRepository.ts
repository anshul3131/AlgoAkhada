import { Repository, QueryRunner } from "typeorm";
import { MatchHistory } from "../../../domain/entities/MatchHistory";
import { AppDataSource } from "../data_source";

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
}

export const matchHistoryRepository = new MatchHistoryRepository();
