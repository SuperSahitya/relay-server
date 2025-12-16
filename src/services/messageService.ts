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
      autoCommit: false,
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        commitOffsetsIfNecessary,
      }) => {
        const validMessages: MessageType[] = [];

        for (const message of batch.messages) {
          try {
            const messageData: MessageType = JSON.parse(
              message.value?.toString() || "{}"
            );
            validMessages.push(messageData);
          } catch (error) {
            consumerLogger.error(
              { error, message },
              "Error parsing message, skipping"
            );
          }
        }

        if (validMessages.length > 0) {
          try {
            await db.insert(messages).values(validMessages);
            consumerLogger.info(
              { count: validMessages.length },
              "Messages saved to database"
            );
          } catch (error) {
            consumerLogger.error({ error }, "Error processing batch");
            throw error;
          }
        }

        for (const message of batch.messages) {
          resolveOffset(message.offset);
        }

        await commitOffsetsIfNecessary();
        await heartbeat();
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
