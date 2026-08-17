import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { userRepository } from "../../infrastructure/database/repositories/UserRepository";
import { UserSearchResponseDTO } from "../classes/UserDTO";

export class UserService {
    public async searchUsers(prefix: string): Promise<ResponseData> {
        try {
            if (!prefix || prefix.trim() === '') {
                return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { users: [] });
            }

            const users = await userRepository.searchUsersByUsernamePrefix(prefix.trim());
            
            const payload: UserSearchResponseDTO = {
                users: users.map(u => ({
                    id: u.id,
                    username: u.username,
                    eloRating: u.elo_rating
                }))
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            console.error('[UserService] searchUsers error:', error.message);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const userService = new UserService();
