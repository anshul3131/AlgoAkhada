import { Kafka, Consumer, EachMessagePayload } from "kafkajs";

class KafkaConsumerClient {
    private consumer: Consumer;

    constructor() {
        const kafka = new Kafka({
            clientId: "cp-arena-consumer",
            brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
        });

        // The groupId is mandatory. All workers with this ID share the load.
        this.consumer = kafka.consumer({ groupId: "code-execution-workers" });
    }

    public async connectAndSubscribe() {
        try {
            await this.consumer.connect();
            console.log("✅ Kafka Consumer connected successfully.");

            // Subscribe to our topic. 
            // fromBeginning: true means if the worker crashes and misses messages, 
            // it will read the backlog when it boots back up.
            await this.consumer.subscribe({ 
                topics: ["code-submissions","testcase-uploads"] ,
                fromBeginning: true 
            });

            // Start the infinite listening loop
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
                    switch (topic) {
                        case "code-submissions":
                            await this.handleCodeSubmission(message);
                            break;
                        case "testcase-uploads":
                            await this.handleTestCaseUpload(message);
                            break;
                        default:
                            console.warn(`⚠️ Received message for unknown topic: ${topic}`);
                    }
                },
            });
        } catch (error) {
            console.error("❌ Fatal error in Kafka Consumer:", error);
            throw error;
        }
    }

    public async gracefulShutdown() {
        try {
            console.log("🛑 Disconnecting Kafka Consumer...");
            await this.consumer.disconnect();
            console.log("✅ Kafka Consumer disconnected.");
        } catch (error) {
            console.error("❌ Error disconnecting Kafka Consumer:", error);
        }
    }

    private async handleCodeSubmission(message: any) {
        // Placeholder for actual code submission processing logic
        console.log("🔧 Processing code submission:", message.value?.toString());
        // Here you would typically parse the message, validate it, and then execute the code or enqueue it for execution.
    }

    private async handleTestCaseUpload(message: any) {
        // Placeholder for actual test case upload processing logic
        console.log("🔧 Processing test case upload:", message.value?.toString());
        // Here you would typically parse the message, validate it, and then process the test case file.
    }
}

export const kafkaConsumerClient = new KafkaConsumerClient();