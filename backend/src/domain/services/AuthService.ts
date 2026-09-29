import { User } from '../../domain/entities/User';
import { userRepository } from '../../infrastructure/database/repositories/UserRepository';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../classes/ResponseDTO';
import { SignUpRequestDTO, LoginRequestDTO, AuthResponseDTO, RefreshRequestDTO } from '../classes/AuthDto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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

            newUser.refresh_token = refreshToken;
            await userRepository.saveEntity(newUser);

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

            user.refresh_token = refreshToken;
            user.last_login_ip = loginRequest.ipAddress || null;
            user.last_login_device = loginRequest.userAgent || null;
            await userRepository.saveEntity(user);

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

            const user = await userRepository.getUserById(decoded.id);
            
            if (!user) {
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.INVALID_TOKEN);
            }

            // --- THEFT DETECTION LOGIC ---
            if (user.refresh_token !== refreshRequest.refreshToken) {
                console.warn(`[SECURITY ALERT] Token mismatch theft detected for user ID: ${user.id}`);
                user.refresh_token = null;
                await userRepository.saveEntity(user);
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, "Security Alert: Invalid token. Account secured and logged out.");
            }

            // --- FINGERPRINT CHECK LOGIC (Layer 2) ---
            if (user.last_login_ip !== refreshRequest.ipAddress || user.last_login_device !== refreshRequest.userAgent) {
                console.warn(`[SECURITY ALERT] Context anomaly detected for user ID: ${user.id}. Old IP: ${user.last_login_ip}, New IP: ${refreshRequest.ipAddress}`);
                
                // You might choose to just prompt for password instead of completely wiping the token,
                // but for maximum security we will wipe it as requested.
                user.refresh_token = null;
                await userRepository.saveEntity(user);
                return ResponseData.build(RESPONSE_CODES.UNAUTHORISED, "Security Alert: Unrecognized device or network. Please log in again.");
            }

            const newAccessToken = this.generateAccessToken(user.id);
            const newRefreshToken = this.generateRefreshToken(user.id);

            user.refresh_token = newRefreshToken;
            // Update fingerprint with current request info just in case
            user.last_login_ip = refreshRequest.ipAddress || null;
            user.last_login_device = refreshRequest.userAgent || null;
            await userRepository.saveEntity(user);

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
            const user = await userRepository.getUserById(userId);
            if (user) {
                user.refresh_token = null;
                await userRepository.saveEntity(user);
            }
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