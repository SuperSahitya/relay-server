import { Kafka } from "kafkajs";
import logger from "../lib/logger";

export const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers: process.env.KAFKA_BROKERS!.split(","),
});

export const producer = kafka.producer({
  idempotent: true,
  maxInFlightRequests: 5,
  retry: {
    retries: 5,
    initialRetryTime: 100,
    maxRetryTime: 30000,
  },
});

export const consumer = kafka.consumer({
  groupId: "messages-consumer-group",
  maxWaitTimeInMs: 1000,
  retry: {
    retries: 8,
    initialRetryTime: 100,
    maxRetryTime: 30000,
  },
});

export const admin = kafka.admin();

export async function createTopics() {
  try {
    await admin.connect();
    const topics = await admin.listTopics();
    if (!topics.includes("chat-messages")) {
      await admin.createTopics({
        topics: [
          {
            topic: "chat-messages",
            numPartitions: 5,
          },
        ],
      });
      console.log("Created topic: chat-messages");
    }
    await admin.disconnect();
  } catch (error) {
    console.error("Error creating topics:", error);
  }
}

export async function initializeProducer() {
  await producer.connect();
}

export async function disconnectProducer() {
  await producer.disconnect();
}

const consumerLogger = logger.child({ module: "disconnectConsumer" });

export async function disconnectConsumer() {
  try {
    consumerLogger.info("Stopping Kafka consumer gracefully...");
    await consumer.stop();
    consumerLogger.info("Kafka consumer stopped, disconnecting...");
    await consumer.disconnect();
    consumerLogger.info("Kafka consumer disconnected");
  } catch (error) {
    consumerLogger.error({ error }, "Error disconnecting consumer:");
    throw error;
  }
}
