/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Standard HTTP response builder matching company API envelope format
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Response } from "express";
import { ResponseData, RESPONSE_CODES } from "../domain/classes/ResponseDTO";

export class ResponseBuilder {
    public static send(res: Response, serviceResponse: ResponseData): Response {
        const isSuccess = serviceResponse.responseCode === RESPONSE_CODES.SUCCESS_HTTP_CODE || 
                          (serviceResponse.responseCode >= 200 && serviceResponse.responseCode < 300);

        if (isSuccess) {
            return res.status(serviceResponse.responseCode).send({
                success: true,
                message: serviceResponse.responseMessage,
                data: serviceResponse.data
            });
        }

        const httpStatus = serviceResponse.responseCode >= 100 && serviceResponse.responseCode < 600
            ? serviceResponse.responseCode
            : 400;

        return res.status(httpStatus).send({
            success: false,
            ERROR_CODE: serviceResponse.responseCode,
            ERROR_MSG: serviceResponse.responseMessage || (typeof serviceResponse.data === 'string' ? serviceResponse.data : undefined),
            data: serviceResponse.data
        });
    }

    public static success(res: Response, status: number, data: any, message?: string): Response {
        return res.status(status).send({ 
            success: true, 
            message,
            data 
        });
    }

    public static error(res: Response, errorCode: string | number, errorMessage: string, status: number = 500): Response {
        return res.status(status).send({ 
            success: false, 
            ERROR_CODE: errorCode, 
            ERROR_MSG: errorMessage 
        });
    }
}