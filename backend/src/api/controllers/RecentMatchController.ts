/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for fetching recent user matches and user win/loss statistics
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Get, QueryParam, Res, Authorized, Req } from "routing-controllers";
import { Response } from "express";
import { Container, Service } from "typedi";
import { RecentMatchService } from "../../domain/services/RecentMatchService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { DEFAULT_RECENT_MATCHES_LIMIT } from "../../constants/AppConstant";

@Service()
@JsonController("/api/matches")
@Authorized()
export class RecentMatchController {
    private recentMatchService: RecentMatchService;

    constructor() {
        this.recentMatchService = Container.get(RecentMatchService);
    }

    @Get("/recent")
    public async getRecentMatches(
        @QueryParam("limit") limit: number,
        @Res() res: Response,
        @Req() req: any
    ) {
        const queryLimit = limit ? Number(limit) : DEFAULT_RECENT_MATCHES_LIMIT;
        const userId = req.user.id;
        const serviceResponse = await this.recentMatchService.getRecentMatches(userId, queryLimit);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/stats")
    public async getUserStats(
        @Res() res: Response,
        @Req() req: any
    ) {
        const userId = req.user.id;
        const serviceResponse = await this.recentMatchService.getUserStats(userId);
        return ResponseBuilder.send(res, serviceResponse);
    }
}
