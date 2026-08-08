import { Kafka, Producer, Partitioners, logLevel } from "kafkajs";

export class KafkaProducerClient {
    private kafka: Kafka;
    private producer: Producer;

    constructor() {
        // Initialize the Kafka instance
        this.kafka = new Kafka({
            clientId: "cp-arena-api", // Identifies your app to the Kafka cluster
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"], // Array of broker addresses
            retry: {
                initialRetryTime: 100,
                retries: 8
            },
            logLevel: logLevel.INFO,
            logCreator: (level) => {
                return ({ namespace, level, label, log }) => {
                    if (log.error === "The group coordinator is not available") {
                        return; // Suppress this specific noisy error
                    }
                    const prefix = namespace ? `[${namespace}] ` : '';
                    const message = JSON.stringify(
                        Object.assign({ level: label }, log, {
                            message: `${prefix}${log.message}`,
                        })
                    );

                    switch (level) {
                        case logLevel.INFO:
                            return console.info(message);
                        case logLevel.ERROR:
                            return console.error(message);
                        case logLevel.WARN:
                            return console.warn(message);
                        case logLevel.DEBUG:
                            return console.log(message);
                    }
                };
            }
        });

        // Create the producer using the recommended Default Partitioner
        this.producer = this.kafka.producer({
            createPartitioner: Partitioners.DefaultPartitioner
        });
    }

    async connect(): Promise<void> {
        try {
            await this.producer.connect();
            console.log("✅ Successfully connected to Kafka Producer");
        } catch (error) {
            console.error("❌ Failed to connect to Kafka Producer:", error);
            throw error;
        }
    }

    async gracefulShutdown(): Promise<void> {
        try {
            await this.producer.disconnect();
            console.log("🔌 Kafka Producer disconnected gracefully");
        } catch (error) {
            console.error("❌ Error disconnecting Kafka Producer:", error);
        }
    }

    // Expose a method to actually send messages to a specific topic
    async sendMessage(topic: string, message: any): Promise<void> {
        await this.producer.send({
            topic,
            messages: [
                { value: JSON.stringify(message) }
            ],
        });
    }
}

// Export a single instance to be shared across the application
export const kafkaProducerClient = new KafkaProducerClient();