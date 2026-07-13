// src/domain/services/UserService.ts
import { User } from "../entities/User";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";

export class UserService {
    async createUser(username: string): Promise<User> {
        // Business Rule: Enforce unique usernames
        const existingUser = await userRepository.getUserByUsername(username);
        if (existingUser) {
            throw new Error("USER_EXISTS");
        }

        const newUser = userRepository.create({ username });
        return await userRepository.saveEntity(newUser);
    }

    async getUser(id: string): Promise<User> {
        const user = await userRepository.getUserById(id);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        return user;
    }
}

// Export a single instance to act as a Singleton across the API
export const userService = new UserService();