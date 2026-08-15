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
            res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
            return res;
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
            res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
            return res;
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
            res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
            return res;
        }

        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const serviceResponse = await authService.refreshAccessToken({ refreshToken, ipAddress, userAgent });
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.cookie('accessToken', serviceResponse.data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 15 * 60 * 1000 });
            res.cookie('refreshToken', serviceResponse.data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
            return res;
        } else {
            res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: serviceResponse.responseMessage });
            return res;
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
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
            return res;
        } else {
            res.status(RESPONSE_CODES.FAILURE).send({ success: false, data: serviceResponse.responseMessage });
            return res;
        }
    }

    @Get('/me')
    @Authorized()
    public async me(@Req() req: any, @Res() res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: RESPONSE_MESSAGES.UNAUTHORIZED });
            return res;
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            res.status(RESPONSE_CODES.UNAUTHORISED).send({ success: false, data: RESPONSE_MESSAGES.USER_NOT_FOUND });
            return res;
        }

        const payload = {
            id: user.id,
            email: user.email,
            username: user.username,
            elo_rating: (user as any).elo_rating,
            created_at: user.created_at,
        };

        res.status(RESPONSE_CODES.SUCCESS_HTTP_CODE).send({ success: true, data: payload });
        return res;
    }

    @Post('/generateToken')
    public async getTestToken(@Body() body: any, @Res() res: Response){
        if (!body.email) {
            res.status(RESPONSE_CODES.INVALID_INPUT).send({ success: false, data: RESPONSE_MESSAGES.INVALID_INPUT });
            return res;
        }

        const serviceResponse = await authService.generateTestToken(body.email);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
            return res;
        } else {
            const statusCode = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600 ? serviceResponse.responseCode : 400;
            res.status(statusCode).send({ success: false, data: serviceResponse.responseMessage });
            return res;
        }
    }
}

export const authController = new AuthController();