import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../../domain/entities/User";
import { Submission } from "../../domain/entities/Submission";
import { TestCase } from "../../domain/entities/TestCase";
import { Problem } from "../../domain/entities/Problem";
import { Match } from "../../domain/entities/Match";
import { MatchHistory } from "../../domain/entities/MatchHistory";
import { CustomMatch } from "../../domain/entities/CustomMatch";
import { CustomMatchParticipant } from "../../domain/entities/CustomMatchParticipant";

// Optional: If you test locally outside of K8s, uncomment this to read a local .env file
// import * as dotenv from "dotenv";
// dotenv.config();

export const AppDataSource = new DataSource({
    type: "postgres",
    // Read from K8s env vars, fallback to localhost for local Mac development
    host: process.env.DB_HOST || "localhost", 
    // process.env returns a string, so we must parse it into a number for TypeORM
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432, 
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "password123",
    database: process.env.DB_NAME || "cp_matchmaker_db",
    
    synchronize: false, 
    logging: true,
    entities: [User, Problem, TestCase, Submission, Match, MatchHistory, CustomMatch, CustomMatchParticipant],
    migrations: ["src/infrastructure/database/migrations/*.ts"],
});