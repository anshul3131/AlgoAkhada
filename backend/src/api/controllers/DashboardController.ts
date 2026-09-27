import { JsonController, Get, Req, Res, Authorized } from "routing-controllers";
import { Response } from "express";
import { dashboardService } from "../../domain/services/DashboardService";
import { RESPONSE_CODES } from "../../domain/classes/ResponseDTO";

@JsonController("/api/dashboard")
export class DashboardController {
    @Get("/")
    @Authorized()
    async getDashboardStats(
        @Req() req: any,
        @Res() res: Response
    ) {
        const userId = req.user.id;
        const serviceResponse = await dashboardService.getDashboardStats(userId);
        
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }

    @Get("/live")
    @Authorized()
    async getLiveMatches(@Res() res: Response) {
        const serviceResponse = await dashboardService.getLiveMatches();
        if (serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE) {
            return res.status(serviceResponse.responseCode).send({ success: true, data: serviceResponse.data });
        } else {
            return res.status(serviceResponse.responseCode).send({ success: false, data: serviceResponse.data });
        }
    }
}
