import { consumer } from "../kafka";
import logger from "../lib/logger";
import { db } from "../db/db";
import { messages, MessageType } from "../db/schema";
import { and, asc, desc, eq, lt } from "drizzle-orm";

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

export async function fetchMessages(
  userA: string,
  userB: string,
  limit: number = 50,
  beforeTime?: Date
) {
  try {
    const conversationId = [userA, userB].sort().join("_");

    let query = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    if (beforeTime) {
      query = db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            lt(messages.createdAt, beforeTime)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit);
    }

    const messageList = await query;

    return {
      success: true,
      data: messageList,
      hasMore: messageList.length === limit,
      cursor: messageList.length > 0 ? messageList[0].createdAt : null,
    };
  } catch (error) {
    consumerLogger.error({ error }, "Error fetching messages");
    return { success: false, message: "Failed to fetch messages" };
  }
}
