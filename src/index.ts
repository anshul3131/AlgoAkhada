import "reflect-metadata";
import * as http from "http";
import app from "./app";
import { AppDataSource } from "./infrastructure/database/data_source";
import { kafkaProducerClient } from "./infrastructure/kafka/KafkaProducerClient";
import { kafkaConsumerClient } from "./infrastructure/kafka/KafkaConsumerClient";

async function startServer(): Promise<void> {
    let server: http.Server | null = null; // 1. Declare server variable here for proper scoping

    // Define the shutdown logic in a clean, accessible scope
    const handleShutdown = (signal: string) => {
        console.log(`\n🛑 ${signal} received: Starting graceful shutdown...`);

        const timeout = setTimeout(() => {
            console.error("❌ Forced shutdown: Could not close connections within 10s.");
            process.exit(1);
        }, 5000);

        const closeConnections = async () => {
            clearTimeout(timeout);
            try {
                // Safely disconnect Kafka with a timeout guard
                await Promise.race([
                    kafkaProducerClient.gracefulShutdown(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Kafka disconnect timeout")), 4000))
                ]);
            } catch (err: any) {
                console.error("⚠️ Warning during Kafka disconnect:", err.message);
            }

            console.log("🏁 Cleanup finished. Exiting process.");
            process.exit(0);
        };

        // If the HTTP server was successfully spun up, close it gracefully first
        if (server) {
            server.close(() => {
                console.log("🏁 HTTP server closed successfully.");
                closeConnections();
            });
        } else {
            // If the server never started (e.g., DB failed), just clean up connections
            closeConnections();
        }
    };

    // Catch system signals early
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    try {
        // 2. Initialize Infrastructure
        await AppDataSource.initialize();
        console.log("✅ Database connection established successfully.");

        // Connect the Kafka Producer before accepting HTTP traffic
        await kafkaProducerClient.connect();
        console.log("✅ Kafka Producer connected successfully.");

        // Connect the Kafka Consumer before accepting HTTP traffic
        await kafkaConsumerClient.connectAndSubscribe();
        console.log("✅ Kafka Consumer connected successfully.");

        // 3. Create and start the HTTP Server
        server = http.createServer(app); // Assign to the outer variable
        const PORT: number = Number(process.env.PORT) || 3000;

        server.keepAliveTimeout = 61 * 1000;

        server.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}...`);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ Fatal error during server startup:", error.message);
        } else {
            console.error("❌ Fatal error during server startup:", error);
        }
        // Force clean up if startup fails after some components connected
        handleShutdown("STARTUP_FAILURE");
    }
}

startServer();