import { JsonController, Get, QueryParam, Res, Authorized, Req } from "routing-controllers";
import { Response } from "express";
import { recentMatchService } from "../../domain/services/RecentMatchService";
import { ResponseBuilder } from "../../utils/ResponseBuilder";
import { RESPONSE_CODES } from "../../domain/classes/ResponseDTO";

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
        if(serviceResponse.responseCode===RESPONSE_CODES.SUCCESS_HTTP_CODE){
            res.status(serviceResponse.responseCode).send({success : true,data : serviceResponse.data})
        }
        else{
            res.status(serviceResponse.responseCode).send({success : false,data : serviceResponse.data})
        }
    }

    @Get("/stats")
    async getUserStats(
        @Res() res: Response,
        @Req() req: any,
    ) {
        const userId = req.user.id;
        const serviceResponse = await recentMatchService.getUserStats(userId);
        if(serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE){
            res.status(serviceResponse.responseCode).send({success: true, data: serviceResponse.data});
        } else {
            res.status(serviceResponse.responseCode).send({success: false, data: serviceResponse.data});
        }
    }
}
