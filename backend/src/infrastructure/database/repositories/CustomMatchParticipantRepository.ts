import { Repository, QueryRunner } from "typeorm";
import { CustomMatchParticipant } from "../../../domain/entities/CustomMatchParticipant";
import { AppDataSource } from "../data_source";

export class CustomMatchParticipantRepository extends Repository<CustomMatchParticipant> {
    constructor() {
        super(CustomMatchParticipant, AppDataSource.createEntityManager());
    }

    async saveEntity(participant: CustomMatchParticipant, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(CustomMatchParticipant).save(participant);
        }
        return await this.save(participant);
    }

    async getParticipantsByMatchId(matchId: string) {
        return await this.find({
            where: { customMatch: { id: matchId } },
            relations: { user: true }
        });
    }
}

export const customMatchParticipantRepository = new CustomMatchParticipantRepository();
