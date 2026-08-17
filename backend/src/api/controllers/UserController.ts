import { Response } from 'express';
import { JsonController, Get, QueryParam, Res, Authorized } from "routing-controllers";
import { userService } from '../../domain/services/UserService';

@JsonController("/api/users")
export class UserController {

    @Authorized()
    @Get('/search')
    public async searchUsers(@QueryParam("prefix") prefix: string, @Res() res: Response) {
        const result = await userService.searchUsers(prefix);
        res.status(result.responseCode).send({ success: result.responseCode < 400, data: result.data });
        return res;
    }

}
