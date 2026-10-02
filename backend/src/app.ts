import express, { Application } from "express";
import cookieParser from "cookie-parser";
import { useExpressServer } from "routing-controllers";
import { SubmissionController } from "./api/controllers/SubmissionController";
import { ProblemController } from "./api/controllers/ProblemController";
import { TestCaseController } from "./api/controllers/TestCaseController";
import { AuthController } from "./api/controllers/AuthController";
import { RecentMatchController } from "./api/controllers/RecentMatchController";
import { ExecutionController } from "./api/controllers/ExecutionController";
import { CustomMatchController } from "./api/controllers/CustomMatchController";
import { UserController } from "./api/controllers/UserController";
import { DashboardController } from "./api/controllers/DashboardController";
import jwt from "jsonwebtoken";
import { Action } from "routing-controllers";

// Initialize the Express Application
const app: Application = express();
app.use(cookieParser());

// Register Controllers using routing-controllers
useExpressServer(app, {
    cors: {
        origin: true,
        credentials: true
    },
    controllers: [AuthController, ProblemController, SubmissionController, TestCaseController, RecentMatchController, ExecutionController, CustomMatchController, UserController, DashboardController], // Add other controllers as needed
    // We disable the default error handler to strictly use our custom ResponseBuilder

    // 1. Add the Authorization Checker
    authorizationChecker: async (action: Action, roles: string[]) => {
        // Look for token in cookies first, then fallback to header
        let token = action.request.cookies?.accessToken;
        
        if (!token) {
            const authHeader = action.request.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return false;
        }

        try {
            // Verify the token signature
            const secret = process.env.JWT_SECRET || 'super_secret_fallback_key';
            const decodedToken = jwt.verify(token, secret);
            
            // Attach the decoded data (like the user ID) to the request so we can use it later
            action.request.user = decodedToken;
            
            return true; // Allows the request to proceed!
        } catch (error) {
            return false; // Token is expired or invalid
        }
    },

    defaultErrorHandler: false 
});

// Global error handler to provide JSON responses for routing-controllers errors
app.use((err: any, req: any, res: any, next: any) => {
    if (res.headersSent) {
        return next(err);
    }

    // If the error is an authorization/unauthorized type, return 401
    const msg = String(err?.message ?? '');
    const name = String(err?.name ?? '');
    if (name.toLowerCase().includes('unauthor') || msg.toLowerCase().includes('authorization') || msg.toLowerCase().includes('authentication')) {
        return res.status(401).send({ success: false, ERROR_MSG: 'Unauthorized' });
    }

    // Fallback: return generic failure JSON
    console.error('Unhandled error in global handler:', err);
    return res.status(500).send({ success: false, ERROR_MSG: 'Internal server error' });
});

// We only export the app; we DO NOT call app.listen() here
export default app;