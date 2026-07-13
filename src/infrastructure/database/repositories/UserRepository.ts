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
}

export const userRepository = new UserRepository();