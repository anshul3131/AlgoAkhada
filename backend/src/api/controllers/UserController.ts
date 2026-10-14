/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for user search autocomplete and discovery
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Response } from 'express';
import { JsonController, Get, QueryParam, Res, Authorized } from "routing-controllers";
import { Container } from "typedi";
import { UserService } from '../../domain/services/UserService';
import { ResponseBuilder } from '../../utils/ResponseBuilder';

@JsonController("/api/users")
export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = Container.get(UserService);
    }

    @Authorized()
    @Get('/search')
    public async searchUsers(@QueryParam("prefix") prefix: string, @Res() res: Response) {
        const result = await this.userService.searchUsers(prefix);
        return ResponseBuilder.send(res, result);
    }
}
