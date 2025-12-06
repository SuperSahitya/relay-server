import { consumer } from "../kafka";
import logger from "../lib/logger";
import { db } from "../db/db";
import { messages, MessageType } from "../db/schema";

const consumerLogger = logger.child({ module: "messageConsumer" });

export async function startMessageConsumer() {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "chat-messages", fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData: MessageType = JSON.parse(
            message.value?.toString() || "{}"
          );

          await db.insert(messages).values(messageData);

          consumerLogger.info(messageData, "Message saved to database");
        } catch (error) {
          consumerLogger.error({ error, message }, "Error processing message");
        }
      },
    });
  } catch (error) {
    consumerLogger.error({ error }, "Failed to start message consumer");
    throw error;
  }
}

export async function stopMessageConsumer() {
  try {
    await consumer.disconnect();
    consumerLogger.info("Consumer disconnected");
  } catch (error) {
    consumerLogger.error({ error }, "Error disconnecting consumer");
  }
}
