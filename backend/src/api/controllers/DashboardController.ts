/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for user dashboard analytics, live match spectating, and composite home-screen
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { JsonController, Get, Req, Res, Authorized } from "routing-controllers";
import { Response } from "express";
import { Container, Service } from "typedi";
import { DashboardService } from "../../domain/services/DashboardService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";

@Service()
@JsonController("/api/dashboard")
export class DashboardController {
    private dashboardService: DashboardService;

    constructor() {
        this.dashboardService = Container.get(DashboardService);
    }

    @Get("/")
    @Authorized()
    public async getDashboardStats(
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user.id;
        const serviceResponse = await this.dashboardService.getDashboardStats(userId);
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/live")
    @Authorized()
    public async getLiveMatches(@Res() res: Response) {
        const serviceResponse = await this.dashboardService.getLiveMatches();
        return ResponseBuilder.send(res, serviceResponse);
    }

    @Get("/home-screen")
    @Authorized()
    public async getHomeScreen(
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user.id;
        const serviceResponse = await this.dashboardService.getHomeScreenData(userId);
        return ResponseBuilder.send(res, serviceResponse);
    }
}
