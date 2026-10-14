/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Controller for custom lobby discovery and details retrieval
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Response } from 'express';
import { JsonController, Get, Param, Res, Authorized } from "routing-controllers";
import { Container } from "typedi";
import { CustomMatchService } from '../../domain/services/CustomMatchService';
import { ResponseData, RESPONSE_CODES, RESPONSE_MESSAGES } from '../../domain/classes/ResponseDTO';
import { ResponseBuilder } from '../../utils/ResponseBuilder';

@JsonController("/api/custom-matches")
export class CustomMatchController {
    private customMatchService: CustomMatchService;

    constructor() {
        this.customMatchService = Container.get(CustomMatchService);
    }

    @Authorized()
    @Get('/public')
    public async getPublicLobbies(@Res() res: Response) {
        const response = await this.customMatchService.getPublicLobbies();
        return ResponseBuilder.send(res, response);
    }

    @Authorized()
    @Get('/:id')
    public async getMatch(@Param("id") id: string, @Res() res: Response) {
        const dto = await this.customMatchService.getLobbyDTO(id);
        if (!dto) {
            return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.NOT_FOUND, RESPONSE_MESSAGES.LOBBY_NOT_FOUND));
        }
        return ResponseBuilder.send(res, ResponseData.build(RESPONSE_CODES.SUCCESS_HTTP_CODE, RESPONSE_MESSAGES.SUCCESS, dto));
    }
}
