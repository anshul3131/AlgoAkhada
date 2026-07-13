import express, { Application } from "express";
import { useExpressServer } from "routing-controllers";
import { UserController } from "./api/controllers/UserController";
import { SubmissionController } from "./api/controllers/SubmissionController";
import { ProblemController } from "./api/controllers/ProblemController";
import { TestCaseController } from "./api/controllers/TestCaseController";

// Initialize the Express Application
const app: Application = express();

// Register Controllers using routing-controllers
useExpressServer(app, {
    controllers: [UserController,ProblemController, SubmissionController,TestCaseController], // Add other controllers as needed
    // We disable the default error handler to strictly use our custom ResponseBuilder
    defaultErrorHandler: false 
});

// We only export the app; we DO NOT call app.listen() here
export default app;