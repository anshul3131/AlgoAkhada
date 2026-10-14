/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for CustomMatchParticipant entity relations and participants lookup
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { CustomMatchParticipant } from "../../../domain/entities/CustomMatchParticipant";
import { AppDataSource } from "../data_source";

@Service()
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
