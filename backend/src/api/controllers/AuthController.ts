import { Response } from 'express';
import { authService } from '../../domain/services/AuthService';
import { JsonController, Post, Body, Res, Req, Authorized, Get } from "routing-controllers";
import { userRepository } from '../../infrastructure/database/repositories/UserRepository';
import { SignUpRequestDTO, LoginRequestDTO, RefreshRequestDTO } from '../../domain/classes/AuthDto';
import { RESPONSE_CODES, RESPONSE_MESSAGES } from '../../domain/classes/ResponseDTO';

@JsonController("/api/users")
export class AuthController {

    @Post('/signup')
    public async signUp(@Req() req: any, @Body() body: SignUpRequestDTO, @Res() res: Response) {
        if (!body.email || !body.password || !body.username) {
            return res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
        }

        body.ipAddress = req.ip || req.connection.remoteAddress;
        body.userAgent = req.headers['user-agent'];

        const serviceResponse = await authService.signUp(body);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.cookie('accessToken', serviceResponse.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000 });
            res.cookie('refreshToken', serviceResponse.data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            return res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
        }
    }

    @Post('/login')
    public async login(@Req() req: any, @Body() body: LoginRequestDTO, @Res() res: Response) {
        if (!body.email || !body.password) {
            return res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
        }

        body.ipAddress = req.ip || req.connection.remoteAddress;
        body.userAgent = req.headers['user-agent'];

        const serviceResponse = await authService.login(body);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.cookie('accessToken', serviceResponse.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000 });
            res.cookie('refreshToken', serviceResponse.data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            return res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
        }
    }

    @Post('/refresh')
    public async refresh(@Req() req: any, @Res() res: Response) {
        // Read refresh token from cookie or body
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const serviceResponse = await authService.refreshAccessToken({ refreshToken, ipAddress, userAgent });
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.cookie('accessToken', serviceResponse.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000 });
            res.cookie('refreshToken', serviceResponse.data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: serviceResponse.responseMessage });
        }
    }

    @Post('/logout')
    @Authorized()
    public async logout(@Req() req: any, @Res() res: Response) {
        const userId = req.user.id;
        const serviceResponse = await authService.logout(userId);
        
        // Clear cookies
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(RESPONSE_CODES.FAILURE).send({ success: false, data: serviceResponse.responseMessage });
        }
    }

    @Get('/me')
    @Authorized()
    public async me(@Req() req: any, @Res() res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: RESPONSE_MESSAGES.UNAUTHORIZED });
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: RESPONSE_MESSAGES.USER_NOT_FOUND });
        }

        const payload = {
            id: user.id,
            email: user.email,
            username: user.username,
            elo_rating: (user as any).elo_rating,
            created_at: user.created_at,
        };

        return res.status(RESPONSE_CODES.SUCCESS_HTTP_CODE).send({ success: true, data: payload });
    }

    @Post('/generateToken')
    public async getTestToken(@Body() body: any, @Res() res: Response){
        if (!body.email) {
            return res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
        }

        const serviceResponse = await authService.generateTestToken(body.email);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            return res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
        }
    }
}

export const authController = new AuthController();