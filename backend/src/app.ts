/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Express application setup and routing-controllers registration with TypeDI container
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import express, { Application, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { useExpressServer, useContainer, Action } from "routing-controllers";
import { Container } from "typedi";
import jwt from "jsonwebtoken";
import { SubmissionController } from "./api/controllers/SubmissionController";
import { ProblemController } from "./api/controllers/ProblemController";
import { TestCaseController } from "./api/controllers/TestCaseController";
import { AuthController } from "./api/controllers/AuthController";
import { RecentMatchController } from "./api/controllers/RecentMatchController";
import { ExecutionController } from "./api/controllers/ExecutionController";
import { CustomMatchController } from "./api/controllers/CustomMatchController";
import { UserController } from "./api/controllers/UserController";
import { DashboardController } from "./api/controllers/DashboardController";
import { ErrorLoggingUtils } from "./utils/ErrorLoggingUtils";
import { COOKIE_NAMES } from "./constants/AuthConstants";
import { _DAY_MS, _SECOND_MS } from "./constants/AppConstant";

// Instruct routing-controllers to use TypeDI container with fallback support
useContainer(Container, { fallback: true, fallbackOnErrors: true });

// Initialize the Express Application
const app: Application = express();
app.use(cookieParser());

// Register Controllers using routing-controllers
useExpressServer(app, {
    cors: {
        origin: true,
        credentials: true,
        maxAge: _DAY_MS / _SECOND_MS
    },
    controllers: [
        AuthController,
        ProblemController,
        SubmissionController,
        TestCaseController,
        RecentMatchController,
        ExecutionController,
        CustomMatchController,
        UserController,
        DashboardController
    ],

    // Authorization Checker for @Authorized() routes
    authorizationChecker: async (action: Action, roles: string[]) => {
        let token = action.request.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
        
        if (!token) {
            const authHeader = action.request.headers["authorization"];
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.split(" ")[1];
            }
        }

        if (!token) {
            return false;
        }

        try {
            const secret = process.env.JWT_SECRET || "super_secret_fallback_key";
            const decodedToken = jwt.verify(token, secret);
            action.request.user = decodedToken;
            return true;
        } catch (error) {
            return false;
        }
    },

    defaultErrorHandler: false 
});

// Global error handler to provide JSON responses for routing-controllers errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
        return next(err);
    }

    const msg = String(err?.message ?? "");
    const name = String(err?.name ?? "");
    if (name.toLowerCase().includes("unauthor") || msg.toLowerCase().includes("authorization") || msg.toLowerCase().includes("authentication")) {
        return res.status(401).send({ success: false, ERROR_MSG: "Unauthorized" });
    }

    ErrorLoggingUtils.logError(err, "GlobalErrorHandler", "use", req);
    return res.status(500).send({ success: false, ERROR_MSG: "Internal server error" });
});

export default app;