/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for authentication, login/signup, session rotation, and user profile resolution
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Response } from 'express';
import { JsonController, Post, Body, Res, Req, Authorized, Get } from "routing-controllers";
import { Container } from "typedi";
import { AuthService } from '../../domain/services/AuthService';
import { UserService } from '../../domain/services/UserService';
import { SignUpRequestDTO, LoginRequestDTO } from '../../domain/classes/AuthDto';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../../domain/classes/ResponseDTO';
import { ResponseBuilder } from '../../utils/ResponseBuilder';
import { COOKIE_NAMES, ACCESS_TOKEN_COOKIE_MAX_AGE_MS, REFRESH_TOKEN_COOKIE_MAX_AGE_MS } from '../../constants/AuthConstants';

@JsonController("/api/users")
export class AuthController {
    private authService: AuthService;
    private userService: UserService;

    constructor() {
        this.authService = Container.get(AuthService);
        this.userService = Container.get(UserService);
    }

    @Post('/signup')
    public async signUp(@Req() req: any, @Body() body: SignUpRequestDTO, @Res() res: Response) {
        if (!body.email || !body.password || !body.username) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        body.ipAddress = req.ip || req.connection?.remoteAddress;
        body.userAgent = req.headers?.['user-agent'];

        const serviceResponse = await this.authService.signUp(body);
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE && serviceResponse.data) {
            res.cookie(COOKIE_NAMES.ACCESS_TOKEN, serviceResponse.data.accessToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS 
            });
            res.cookie(COOKIE_NAMES.REFRESH_TOKEN, serviceResponse.data.refreshToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS 
            });
        }
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post('/login')
    public async login(@Req() req: any, @Body() body: LoginRequestDTO, @Res() res: Response) {
        if (!body.email || !body.password) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        body.ipAddress = req.ip || req.connection?.remoteAddress;
        body.userAgent = req.headers?.['user-agent'];

        const serviceResponse = await this.authService.login(body);
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE && serviceResponse.data) {
            res.cookie(COOKIE_NAMES.ACCESS_TOKEN, serviceResponse.data.accessToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS 
            });
            res.cookie(COOKIE_NAMES.REFRESH_TOKEN, serviceResponse.data.refreshToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS 
            });
        }
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post('/refresh')
    public async refresh(@Req() req: any, @Res() res: Response) {
        const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] || req.body?.refreshToken;
        if (!refreshToken) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        const ipAddress = req.ip || req.connection?.remoteAddress;
        const userAgent = req.headers?.['user-agent'];

        const serviceResponse = await this.authService.refreshAccessToken({ refreshToken, ipAddress, userAgent });
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE && serviceResponse.data) {
            res.cookie(COOKIE_NAMES.ACCESS_TOKEN, serviceResponse.data.accessToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_MS 
            });
            res.cookie(COOKIE_NAMES.REFRESH_TOKEN, serviceResponse.data.refreshToken, { 
                httpOnly: true, 
                secure: true, 
                sameSite: 'none', 
                maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS 
            });
        }
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post('/logout')
    @Authorized()
    public async logout(@Req() req: any, @Res() res: Response) {
        const userId = req.user?.id;
        const serviceResponse = await this.authService.logout(userId);
        
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { secure: true, sameSite: 'none' });
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { secure: true, sameSite: 'none' });
        
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get('/me')
    @Authorized()
    public async me(@Req() req: any, @Res() res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.UNAUTHORISED, RESPONSE_MESSAGES.UNAUTHORIZED));
        }

        const serviceResponse = await this.userService.getUserProfile(userId);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Post('/generateToken')
    public async getTestToken(@Body() body: any, @Res() res: Response) {
        if (!body.email) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.INVALID_INPUT, RESPONSE_MESSAGES.INVALID_INPUT));
        }

        const serviceResponse = await this.authService.generateTestToken(body.email);
        return ResponseBuilder.send(res, serviceResponse);
    }
}