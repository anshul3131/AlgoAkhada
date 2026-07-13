import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../../domain/entities/User";
import { Submission } from "../../domain/entities/Submission";
import { TestCase } from "../../domain/entities/TestCase";
import { Problem } from "../../domain/entities/Problem";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres", // Replace with your local Postgres username
    password: "password123", // Replace with your local Postgres password
    database: "cp_matchmaker_db", // Make sure you create this DB in Postgres first!
    synchronize: false, // Auto-creates tables based on Entities (Great for dev, disable in prod)
    logging: true, // Logs raw SQL queries to your terminal
    entities: [User, Problem, TestCase, Submission],
    migrations: ["src/infrastructure/database/migrations/*.ts"],
});