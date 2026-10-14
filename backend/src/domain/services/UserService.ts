/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Service for user profile discovery, search autocomplete, and metadata management
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from "../classes/ResponseDTO";
import { userRepository, UserRepository } from "../../infrastructure/database/repositories/UserRepository";
import { UserSearchResponseDTO } from "../classes/UserDTO";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { EMPTY_STRING } from "../../constants/AppConstant";

@Service()
export class UserService {
    private userRepository: UserRepository;

    constructor() {
        this.userRepository = userRepository;
    }

    public async searchUsers(prefix: string): Promise<ResponseData> {
        try {
            if (!prefix || prefix.trim() === EMPTY_STRING) {
                return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { users: [] });
            }

            const users = await this.userRepository.searchUsersByUsernamePrefix(prefix.trim());
            
            const payload: UserSearchResponseDTO = {
                users: users.map(u => ({
                    id: u.id,
                    username: u.username,
                    eloRating: u.elo_rating
                }))
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, payload);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'UserService', 'searchUsers', { prefix });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async getUserProfile(userId: string): Promise<ResponseData> {
        try {
            const user = await this.userRepository.getUserById(userId);
            if (!user) {
                return ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.USER_NOT_FOUND);
            }
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, {
                id: user.id,
                email: user.email,
                username: user.username,
                elo_rating: user.elo_rating,
                max_elo_rating: user.max_elo_rating,
                avatar_url: user.avatar_url,
                created_at: user.created_at
            });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'UserService', 'getUserProfile', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const userService = Container.get(UserService);
