import express, { Application } from "express";
import { useExpressServer } from "routing-controllers";
import { SubmissionController } from "./api/controllers/SubmissionController";
import { ProblemController } from "./api/controllers/ProblemController";
import { TestCaseController } from "./api/controllers/TestCaseController";
import { AuthController } from "./api/controllers/AuthController";
import jwt from "jsonwebtoken";
import { Action } from "routing-controllers";

// Initialize the Express Application
const app: Application = express();

// Register Controllers using routing-controllers
useExpressServer(app, {
    controllers: [AuthController,ProblemController, SubmissionController,TestCaseController], // Add other controllers as needed
    // We disable the default error handler to strictly use our custom ResponseBuilder

    // 1. Add the Authorization Checker
    authorizationChecker: async (action: Action, roles: string[]) => {
        // Look for the header: "Authorization: Bearer <token>"
        const authHeader = action.request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false; // Blocks the request (sends a 401 Unauthorized)
        }

        const token = authHeader.split(' ')[1];

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

// We only export the app; we DO NOT call app.listen() here
export default app;