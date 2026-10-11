import { User } from '../../domain/entities/User';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../classes/ResponseDTO';
import { SignUpRequestDTO, LoginRequestDTO, AuthResponseDTO, RefreshRequestDTO } from '../classes/AuthDto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { redisClient } from '../../infrastructure/redis/RedisClient';

export class AuthService {
    
    private jwtSecret = process.env.JWT_SECRET || 'super_secret_fallback_key';
    private jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_fallback_key';

    public async signUp(signUpRequest: SignUpRequestDTO): Promise<ResponseData> {
        try {
            const existingUser = await userRepository.getUserByEmail(signUpRequest.email);
            if (existingUser) {
                return ResponseData.build(RESPONSE_CODES.ALREADY_EXIST, RESPONSE_MESSAGES.ALREADY_EXIST);
            }

            const hashedPassword = await bcrypt.hash(signUpRequest.password, 10);

            const newUser : User = userRepository.create({
                email: signUpRequest.email,
                username: signUpRequest.username,
                password: hashedPassword,
                last_login_ip: signUpRequest.ipAddress || null,
                last_login_device: signUpRequest.userAgent || null,
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${signUpRequest.username}`
            });
            await userRepository.saveEntity(newUser);

            const accessToken = this.generateAccessToken(newUser.id);
            const refreshToken = this.generateRefreshToken(newUser.id);

            // Store transient session token in Redis (7 days TTL)
            await redisClient.client.setEx(`refresh_token:${newUser.id}`, 7 * 24 * 3600, refreshToken);

            const data: AuthResponseDTO = {
                user: { id: newUser.id, email: newUser.email, username: newUser.username, elo_rating: newUser.elo_rating, max_elo_rating: newUser.max_elo_rating, avatar_url: newUser.avatar_url },
                accessToken,
                refreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[AuthService] signUp error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async login(loginRequest: LoginRequestDTO): Promise<ResponseData> {
        try {
            const user = await userRepository.getUserByEmail(loginRequest.email);
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
            await redisClient.client.setEx(`refresh_token:${user.id}`, 7 * 24 * 3600, refreshToken);

            // 2. Persist audit metadata in Postgres via UserRepository method
            await userRepository.updateLoginMetadata(user.id, loginRequest.ipAddress, loginRequest.userAgent);

            const data: AuthResponseDTO = {
                user: { id: user.id, email: user.email, username: user.username, elo_rating: user.elo_rating, max_elo_rating: user.max_elo_rating, avatar_url: user.avatar_url },
                accessToken,
                refreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[AuthService] login error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    public async refreshAccessToken(refreshRequest: RefreshRequestDTO): Promise<ResponseData> {
        try {
            const decoded = jwt.verify(refreshRequest.refreshToken, this.jwtRefreshSecret) as { id: string };

            // 1. Check Redis for active session
            const storedRefreshToken = await redisClient.client.get(`refresh_token:${decoded.id}`);

            if (!storedRefreshToken) {
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.INVALID_TOKEN);
            }

            // --- THEFT DETECTION LOGIC ---
            if (storedRefreshToken !== refreshRequest.refreshToken) {
                console.warn(`[SECURITY ALERT] Token mismatch theft detected for user ID: ${decoded.id}`);
                await redisClient.client.del(`refresh_token:${decoded.id}`);
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, "Security Alert: Invalid token. Account secured and logged out.");
            }

            const newAccessToken = this.generateAccessToken(decoded.id);
            const newRefreshToken = this.generateRefreshToken(decoded.id);

            // Purely in-memory session rotation in Redis (sub-millisecond, zero Postgres disk I/O)
            await redisClient.client.setEx(`refresh_token:${decoded.id}`, 7 * 24 * 3600, newRefreshToken);

            const data = {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken
            };

            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, data);
        } catch (error: any) {
            console.error(`[AuthService] refreshAccessToken error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.INVALID_TOKEN);
        }
    }

    public async logout(userId: string): Promise<ResponseData> {
        try {
            await redisClient.client.del(`refresh_token:${userId}`);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS);
        } catch(error: any) {
            console.error(`[AuthService] logout error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }

    private generateAccessToken(userId: string | number): string {
        return jwt.sign({ id: userId }, this.jwtSecret, { expiresIn: '15m' });
    }

    private generateRefreshToken(userId: string | number): string {
        return jwt.sign({ id: userId }, this.jwtRefreshSecret, { expiresIn: '7d' });
    }

    public async generateTestToken(email: string): Promise<ResponseData> {
        try {
            if (process.env.NODE_ENV === 'production') {
                return ResponseData.build(RESPONSE_CODES.NOT_ALLOWED, RESPONSE_MESSAGES.NOT_ALLOWED);
            }

            const user = await userRepository.getUserByEmail(email);
            if (!user) {
                return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.USER_NOT_FOUND);
            }

            const accessToken = this.generateAccessToken(user.id);
            return ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, { token: accessToken });
        } catch (error: any) {
            console.error(`[AuthService] testToken error: ${error.message}`);
            return ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG);
        }
    }
}

export const authService = new AuthService();