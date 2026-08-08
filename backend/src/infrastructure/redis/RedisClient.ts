import { createClient } from "redis";

class RedisClient {
    public client: ReturnType<typeof createClient>;

    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379"
        });

        this.client.on("error", (err) => console.error("Redis Client Error", err));
    }

    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
            console.log("✅ Redis Client connected successfully.");
        }
    }

    async disconnect() {
        if (this.client.isOpen) {
            await this.client.disconnect();
            console.log("✅ Redis Client disconnected.");
        }
    }
}

export const redisClient = new RedisClient();
