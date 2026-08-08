import { Repository, QueryRunner } from "typeorm";
import { Match } from "../../../domain/entities/Match";
import { AppDataSource } from "../data_source";

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
}

export const matchRepository = new MatchRepository();
