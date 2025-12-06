import { eq } from "drizzle-orm";
import { db } from "../db/db";
import { user } from "../db/schema";
import logger from "../lib/logger";
import { verifyFriends } from "./friendService";

const userServiceLogger = logger.child({ module: "userServiceLogger" });

export async function getUserById(userId: string) {
  try {
    const userData = await db
      .selectDistinct()
      .from(user)
      .where(eq(user.id, userId));

    return userData;
  } catch (error) {
    userServiceLogger.error({ error, userId }, "Error while validating user.");
  }
}

export async function canUserMessage(userId: string, receiverId: string) {
  try {
    const sender = await getUserById(userId);
    const receiver = await getUserById(receiverId);

    if (!sender || !receiver) {
      userServiceLogger.warn(
        { userId, receiverId },
        "Sender or receiver not found"
      );
      return false;
    }

    const areFriends = await verifyFriends(userId, receiverId);
    if (!areFriends) {
      userServiceLogger.warn({ userId, receiverId }, "Users are not friends");
      return false;
    }

    return true;
  } catch (error) {
    userServiceLogger.error(
      { error, userId, receiverId },
      "Error validating message permission"
    );
  }
}
