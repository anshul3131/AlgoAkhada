import { Request, Response } from 'express';
import { authService } from '../../domain/services/AuthService';
import { ResponseBuilder } from '../../utils/ResponseBuilder';
import { JsonController, Post, Get, Body, Param, Res,Req } from "routing-controllers";

@JsonController("/api/users")
export class AuthController {

    @Post('/signup')
    public async signUp(@Body() body: any, @Res() res: Response) {
        try {
            // console.log(req)
            const { email, password, username } = body;

            // Basic validation
            if (!email || !password || !username) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Email, password, and username are required", 400);
            }

            const data = await authService.signUp(email, password, username);

            // Remove the password hash from the response data for security!
            delete (data.user as any).password;

            return ResponseBuilder.success(res,201, data, "User created successfully");

        } catch (error: any) {
            return ResponseBuilder.error(res, "FAILURE", error.message, 500);
        }
    }

    @Post('/login')
    public async login(@Body() body: any, @Res() res: Response) {
        try {
            const { email, password } = body;

            if (!email || !password) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Email and password are required", 400);
            }

            const data = await authService.login(email, password);

            // Remove the password hash from the response
            delete (data.user as any).password;

            return ResponseBuilder.success(res,201, data, "Login successful");

        } catch (error: any) {
            // Keep error messages generic on login to prevent "email harvesting"
            return ResponseBuilder.error(res, "FAILURE", "Invalid credentials", 500);
        }
    }

    @Post('/generateToken')
    // Add this inside AuthController.ts
    public async getTestToken(@Body() body: any, @Res() res: Response){
        try {
            const { email } = body;
            const token = await authService.generateTestToken(email);
            
            return ResponseBuilder.success(res, 200,{ token }, `Test token generated for ${email}`);
        } catch (error: any) {
            return ResponseBuilder.error(res,"FAILURE", error.message, 403);
        }
    }
}

export const authController = new AuthController();