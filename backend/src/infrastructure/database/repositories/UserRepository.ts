/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Data access repository for User entity operations and queries
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Repository, QueryRunner } from "typeorm";
import { Service } from "typedi";
import { User } from "../../../domain/entities/User";
import { AppDataSource } from "../data_source";
import { DEFAULT_SEARCH_LIMIT } from "../../../constants/AppConstant";

@Service()
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

    async searchUsersByUsernamePrefix(prefix: string, limit: number = DEFAULT_SEARCH_LIMIT) {
        return await this.createQueryBuilder("user")
            .where("user.username ILIKE :prefix", { prefix: `${prefix}%` })
            .select(["user.id", "user.username", "user.elo_rating"])
            .take(limit)
            .getMany();
    }

    async updateLoginMetadata(userId: string, ipAddress?: string | null, userAgent?: string | null): Promise<void> {
        await this.update(userId, {
            last_login_ip: ipAddress || null,
            last_login_device: userAgent || null
        });
    }

    async clearRefreshToken(userId: string): Promise<void> {
        await this.update(userId, { refresh_token: null });
    }

    async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
        await this.update(userId, { refresh_token: refreshToken });
    }
}

export const userRepository = new UserRepository();