import { Repository, QueryRunner } from "typeorm";
import { User } from "../../../domain/entities/User";
import { AppDataSource } from "../data_source";

export class UserRepository extends Repository<User> {
    constructor() {
        // TypeORM 0.3.x requires passing the target entity and manager to super()
        super(User, AppDataSource.createEntityManager());
    }

    async saveEntity(user: User, queryRunner?: QueryRunner) {
        if (queryRunner) {
            return await queryRunner.manager.getRepository(User).save(user);
        }
        return await this.save(user);
    }

    async getUserById(id: string) {
        return await this.findOne({ where: { id } });
    }

    async getUserByUsername(username: string) {
        return await this.findOne({ where: { username } });
    }

    async getUserByEmail(email: string) {
        return await this.findOne({ where: { email } });
    }

    async searchUsersByUsernamePrefix(prefix: string, limit: number = 10) {
        return await this.createQueryBuilder("user")
            .where("user.username ILIKE :prefix", { prefix: `${prefix}%` })
            .select(["user.id", "user.username", "user.elo_rating"])
            .take(limit)
            .getMany();
    }
}

export const userRepository = new UserRepository();