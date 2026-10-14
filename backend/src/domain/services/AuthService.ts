/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Authentication service handling user registration, login, token refresh, theft detection, and logout
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Service, Container } from "typedi";
import { User } from '../../domain/entities/User';
import { userRepository, UserRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../classes/ResponseDTO';
import { SignUpRequestDTO, LoginRequestDTO, AuthResponseDTO, RefreshRequestDTO } from '../classes/AuthDto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { redisCache } from '../../infrastructure/redis/RedisCache';
import { RedisKeys } from '../../infrastructure/redis/RedisConstants';
import { ErrorLoggingUtils } from '../../utils/ErrorLoggingUtils';
import { logger } from '../../utils/LogglyClient';
import { BCRYPT_SALT_ROUNDS, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY } from '../../constants/AuthConstants';
import { cacheExpirySeconds } from '../../constants/CacheConstants';

@Service()
export class AuthService {
    private userRepository: UserRepository;
    private jwtSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    private jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_fallback_key';

    constructor() {
        this.userRepository = userRepository;
    }

    public async signUp(signUpRequest: SignUpRequestDTO): Promise<ResponseData> {
        try {
            const existingUser = await this.userRepository.getUserByEmail(signUpRequest.email);
            if (existingUser) {
                return ResponseData.build(RESPONSE_CODES.ALREADY_EXIST, RESPONSE_MESSAGES.ALREADY_EXIST);
            }

            const hashedPassword = await bcrypt.hash(signUpRequest.password, BCRYPT_SALT_ROUNDS);

            const newUser: User = this.userRepository.create({
                email: signUpRequest.email,
                username: signUpRequest.username,
                password: hashedPassword,
                last_login_ip: signUpRequest.ipAddress || null,
                last_login_device: signUpRequest.userAgent || null,
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${signUpRequest.username}`
            });
            await this.userRepository.saveEntity(newUser);

            const accessToken = this.generateAccessToken(newUser.id);
            const refreshToken = this.generateRefreshToken(newUser.id);

            // Store transient session token in Redis (7 days TTL)
            await redisCache.setEx(RedisKeys.getRefreshTokenKey(newUser.id), cacheExpirySeconds.SEVEN_DAYS, refreshToken);

            const data: AuthResponseDTO = {
                user: { 
                    id: newUser.id, 
                    email: newUser.email, 
                    username: newUser.username, 
                    elo_rating: newUser.elo_rating, 
                    max_elo_rating: newUser.max_elo_rating, 
                    avatar_url: newUser.avatar_url 
                },
                accessToken,
                refreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'AuthService', 'signUp', { email: signUpRequest.email, username: signUpRequest.username });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async login(loginRequest: LoginRequestDTO): Promise<ResponseData> {
        try {
            const user = await this.userRepository.getUserByEmail(loginRequest.email);
            if (!user) {
                return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.USER_NOT_FOUND);
            }

            const isPasswordValid = await bcrypt.compare(loginRequest.password, user.password);
            if (!isPasswordValid) {
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.UNAUTHORIZED);
            }

            const accessToken = this.generateAccessToken(user.id);
            const refreshToken = this.generateRefreshToken(user.id);

            // 1. Store transient session token in Redis (7-day TTL)
            await redisCache.setEx(RedisKeys.getRefreshTokenKey(user.id), cacheExpirySeconds.SEVEN_DAYS, refreshToken);

            // 2. Persist audit metadata in Postgres
            await this.userRepository.updateLoginMetadata(user.id, loginRequest.ipAddress, loginRequest.userAgent);

            const data: AuthResponseDTO = {
                user: { 
                    id: user.id, 
                    email: user.email, 
                    username: user.username, 
                    elo_rating: user.elo_rating, 
                    max_elo_rating: user.max_elo_rating, 
                    avatar_url: user.avatar_url 
                },
                accessToken,
                refreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'AuthService', 'login', { email: loginRequest.email });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async refreshAccessToken(refreshRequest: RefreshRequestDTO): Promise<ResponseData> {
        try {
            const decoded = jwt.verify(refreshRequest.refreshToken, this.jwtRefreshSecret) as { id: string };

            const storedRefreshToken = await redisCache.get<string>(RedisKeys.getRefreshTokenKey(decoded.id));

            if (!storedRefreshToken) {
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.INVALID_TOKEN);
            }

            // Theft Detection: Token mismatch indicates token re-use or theft
            if (storedRefreshToken !== refreshRequest.refreshToken) {
                logger.warn(`[SECURITY ALERT] Token mismatch theft detected for user ID: ${decoded.id}`);
                await redisCache.del(RedisKeys.getRefreshTokenKey(decoded.id));
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.THEFT_OCCUR);
            }

            const newAccessToken = this.generateAccessToken(decoded.id);
            const newRefreshToken = this.generateRefreshToken(decoded.id);

            await redisCache.setEx(RedisKeys.getRefreshTokenKey(decoded.id), cacheExpirySeconds.SEVEN_DAYS, newRefreshToken);

            const data = {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'AuthService', 'refreshAccessToken');
            return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.INVALID_TOKEN);
        }
    }

    public async logout(userId: string): Promise<ResponseData> {
        try {
            await redisCache.del(RedisKeys.getRefreshTokenKey(userId));
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS);
        } catch(error: any) {
            ErrorLoggingUtils.logError(error, 'AuthService', 'logout', { userId });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    private generateAccessToken(userId: string | number): string {
        return jwt.sign({ id: userId }, this.jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
    }

    private generateRefreshToken(userId: string | number): string {
        return jwt.sign({ id: userId }, this.jwtRefreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY });
    }

    public async generateTestToken(email: string): Promise<ResponseData> {
        try {
            if (process.env.NODE_ENV === 'production') {
                return ResponseData.build(RESPONSE_CODES.NOT_ALLOWED, RESPONSE_MESSAGES.NOT_ALLOWED);
            }

            const user = await this.userRepository.getUserByEmail(email);
            if (!user) {
                return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.USER_NOT_FOUND);
            }

            const accessToken = this.generateAccessToken(user.id);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { token: accessToken });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, 'AuthService', 'generateTestToken', { email });
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const authService = Container.get(AuthService);