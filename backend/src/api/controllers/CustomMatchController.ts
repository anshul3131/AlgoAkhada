import { Response } from 'express';
import { JsonController, Get, Param, Res, Authorized } from "routing-controllers";
import { customMatchService } from '../../domain/services/CustomMatchService';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../../domain/classes/ResponseDTO';

@JsonController("/api/custom-matches")
export class CustomMatchController {

    @Authorized()
    @Get('/:id')
    public async getMatch(@Param("id") id: string, @Res() res: Response) {
        const dto = await customMatchService.getLobbyDTO(id);
        if (!dto) {
            res.status(RESPONSE_CODES.NOT_FOUND).send({ success: false, data: RESPONSE_MESSAGES.LOBBY_NOT_FOUND });
            return res;
        }
        res.status(RESPONSE_CODES.SUCCESS_HTTP_CODE).send({ success: true, data: dto });
        return res;
    }
}
