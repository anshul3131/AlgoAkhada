/**
 * @author : anshul-agarwal
 * @since : 14/10/2026, Wednesday
 * @desc : Centralized Kafka producer client for publishing match and code submission events
 * @note : To change this template use File | Settings | File and Code Templates.
 **/

import { Kafka, Producer, Partitioners, logLevel } from "kafkajs";
import { logger } from "../../utils/LogglyClient";
import { ErrorLoggingUtils } from "../../utils/ErrorLoggingUtils";
import { KafkaConfig } from "../../constants/KafkaConstants";

export class KafkaProducerClient {
    private kafka: Kafka;
    private producer: Producer;

    constructor() {
        this.kafka = new Kafka({
            clientId: KafkaConfig.CLIENT_ID_PRODUCER,
            brokers: [process.env.KAFKA_BROKER || "localhost:9092"],
            retry: {
                initialRetryTime: KafkaConfig.INITIAL_RETRY_TIME_MS,
                retries: KafkaConfig.MAX_RETRIES
            },
            logLevel: logLevel.INFO,
            logCreator: (level) => {
                return ({ namespace, level, label, log }) => {
                    if (log.error === "The group coordinator is not available") {
                        return;
                    }
                    const prefix = namespace ? `[${namespace}] ` : "";
                    const message = JSON.stringify(
                        Object.assign({ level: label }, log, {
                            message: `${prefix}${log.message}`,
                        })
                    );

                    switch (level) {
                        case logLevel.INFO:
                            return logger.info(message);
                        case logLevel.ERROR:
                            return logger.error(message);
                        case logLevel.WARN:
                            return logger.warn(message);
                        case logLevel.DEBUG:
                            return logger.debug(message);
                    }
                };
            }
        });

        this.producer = this.kafka.producer({
            createPartitioner: Partitioners.DefaultPartitioner
        });
    }

    async connect(): Promise<void> {
        try {
            await this.producer.connect();
            logger.info("✅ Successfully connected to Kafka Producer");
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaProducerClient", "connect");
            throw error;
        }
    }

    async gracefulShutdown(): Promise<void> {
        try {
            await this.producer.disconnect();
            logger.info("🔌 Kafka Producer disconnected gracefully");
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaProducerClient", "gracefulShutdown");
        }
    }

    async sendMessage(topic: string, message: any): Promise<void> {
        try {
            await this.producer.send({
                topic,
                messages: [
                    { value: JSON.stringify(message) }
                ],
            });
        } catch (error: any) {
            ErrorLoggingUtils.logError(error, "KafkaProducerClient", "sendMessage", { topic, message });
            throw error;
        }
    }
}

export const kafkaProducerClient = new KafkaProducerClient();