// src/utils/ResponseBuilder.ts
import { Response } from "express";

export class ResponseBuilder {
    static success(res: Response,status : number, data: any,message? : string) {
        return res.status(status).send({ 
            success: true, 
            message,
            data 
        });
    }

    static error(res: Response, errorCode: string | number, errorMessage: string, status: number = 500) {
        return res.status(status).send({ 
            success: false, 
            ERROR_CODE: errorCode, 
            ERROR_MSG: errorMessage 
        });
    }
}