import { Repository, QueryRunner } from "typeorm";
import { CustomMatch } from "../../../domain/entities/CustomMatch";
import { AppDataSource } from "../data_source";
import { MatchStatus } from "../../../domain/enums/MatchStatus";
import { PublicLobbyDTO } from "../../../domain/classes/PublicLobbyDTO";

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

    async getPublicLobbies(): Promise<PublicLobbyDTO[]> {
        const raw = await this.createQueryBuilder("cm")
            .innerJoin("cm.host", "host")
            .leftJoin("cm.participants", "p")
            .where("cm.isPublic = :isPublic", { isPublic: true })
            .andWhere("cm.status = :status", { status: MatchStatus.NOT_STARTED })
            .select([
                "cm.id AS id",
                "host.id AS \"hostId\"",
                "host.username AS \"hostUsername\"",
                "cm.timeLimit AS \"timeLimit\"",
                "cm.maxParticipants AS \"maxParticipants\"",
                "cm.joinCode AS \"joinCode\"",
                "cm.topic AS topic",
                "cm.name AS name",
                "cm.difficulty AS difficulty",
                "COUNT(p.id)::int AS \"participantCount\""
            ])
            .groupBy("cm.id")
            .addGroupBy("host.id")
            .addGroupBy("host.username")
            .orderBy("cm.created_at", "DESC")
            .getRawMany();

        return raw.map(r => ({
            id: r.id,
            hostId: r.hostId,
            hostUsername: r.hostUsername,
            timeLimit: Number(r.timeLimit),
            maxParticipants: Number(r.maxParticipants),
            joinCode: r.joinCode,
            topic: r.topic,
            name: r.name,
            difficulty: r.difficulty,
            participantCount: Number(r.participantCount) || 0
        }));
    }
}

export const customMatchRepository = new CustomMatchRepository();
