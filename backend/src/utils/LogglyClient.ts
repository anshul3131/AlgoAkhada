/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Centralized Winston logger client matching company production standards
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import winston from "winston";

const APP_NAME = process.env.APP_NAME || "AlgoAkhada";
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : "";
        const formattedMsg = typeof message === "object" ? JSON.stringify(message, null, 2) : message;
        return `[${timestamp}] [${APP_NAME}] [${level.toUpperCase()}]: ${formattedMsg}${metaStr}`;
    })
);

const createLogger = () => {
    return winston.createLogger({
        level: LOG_LEVEL,
        format: customFormat,
        transports: [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize({ all: true }),
                    customFormat
                )
            })
        ]
    });
};

export const logger = createLogger();
