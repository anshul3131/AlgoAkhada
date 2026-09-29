import { Repository, QueryRunner } from "typeorm";
import { CustomMatch } from "../../../domain/entities/CustomMatch";
import { AppDataSource } from "../data_source";

export class CustomMatchRepository extends Repository<CustomMatch> {
    constructor() {
        super(CustomMatch, AppDataSource.createEntityManager());
    }

    async saveEntity(match: CustomMatch, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(CustomMatch).save(match);
        }
        return await this.save(match);
    }

    async getMatchById(id: string) {
        return await this.findOne({ 
            where: { id },
            relations: {
                host: true,
                problem: true,
                participants: {
                    user: true,
                },
            },
        });
    }

    async getMatchByCode(joinCode: string) {
        return await this.findOne({ 
            where: { joinCode },
            relations: {
                host: true,
                problem: true,
                participants: {
                    user: true,
                },
            },
        });
    }

    async getPublicLobbies() {
        return await this.find({
            where: { isPublic: true, status: "NOT_STARTED" as any },
            relations: {
                host: true,
                participants: { user: true }
            },
            order: { created_at: "DESC" }
        });
    }
}

export const customMatchRepository = new CustomMatchRepository();
