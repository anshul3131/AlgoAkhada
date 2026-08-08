import { JsonController, Get, QueryParam, Res, Authorized, Req } from "routing-controllers";
import { Response } from "express";
import { recentMatchService } from "../../domain/services/RecentMatchService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@JsonController("/api/matches")
@Authorized()
export class RecentMatchController {

    @Get("/recent")
    async getRecentMatches(
        @QueryParam("limit") limit: number,
        @Res() res: Response,
        @Req() req: any,
    ) {
        limit = limit ? Number(limit) : 10;
        const userId = req.user.id;

        const serviceResponse = await recentMatchService.getRecentMatches(userId, limit, res);
        res.status(serviceResponse.responseCode).send(serviceResponse.data)
    }
}
