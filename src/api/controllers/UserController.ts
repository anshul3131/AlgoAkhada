// src/api/controllers/UserController.ts
import { JsonController, Post, Get, BodyParam, Param, Res } from "routing-controllers";
import { Response } from "express";
import { userService } from "../../domain/services/UserService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@JsonController("/api/users")
export class UserController {
    
    @Post()
    async createUser(@BodyParam("username") username: string, @Res() res: Response) {
        try {
            if (!username) {
                return ResponseBuilder.error(res, "INVALID_INPUT", "Username is required", 400);
            }
            
            const newUser = await userService.createUser(username);
            return ResponseBuilder.success(res, newUser, 201);

        } catch (error: any) {
            console.error(`[UserController] createUser error: ${error.message}`);
            
            if (error.message === "USER_EXISTS") {
                return ResponseBuilder.error(res, "CONFLICT", "Username already exists", 409);
            }
            
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }

    @Get("/:id")
    async getUser(@Param("id") id: string, @Res() res: Response) {
        try {
            const user = await userService.getUser(id);
            return ResponseBuilder.success(res, user, 200);

        } catch (error: any) {
            console.error(`[UserController] getUser error: ${error.message}`);
            
            if (error.message === "USER_NOT_FOUND") {
                return ResponseBuilder.error(res, "NOT_FOUND", "User not found", 404);
            }
            
            return ResponseBuilder.error(res, "FAILURE", "Internal server error", 500);
        }
    }
}