import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../../domain/entities/User";

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: 5432,
    username: "postgres", // Replace with your local Postgres username
    password: "password", // Replace with your local Postgres password
    database: "cp_arena_db", // Make sure you create this DB in Postgres first!
    synchronize: true, // Auto-creates tables based on Entities (Great for dev, disable in prod)
    logging: true, // Logs raw SQL queries to your terminal
    entities: [User],
});