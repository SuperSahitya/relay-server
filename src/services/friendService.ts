import { and, eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { friend } from "../db/schema";
import logger from "../lib/logger";
import { success } from "zod";

const friendServiceLogger = logger.child({ module: "friendServiceLogger" });

export async function addFriend(userId: string, friendId: string) {
  try {
    if (userId === friendId) {
      return { success: false, message: "Cannot add yourself as a friend." };
    }
    const alreadyFriends = await verifyFriends(userId, friendId);
    if (alreadyFriends) {
      return { success: false, message: "Already friends." };
    }
    const data = await db.insert(friend).values({ userId, friendId });
    return { success: true, data };
  } catch (error) {
    friendServiceLogger.error(error, "Error while adding friend.");
    return { success: false, error };
  }
}

export async function verifyFriends(userId: string, friendId: string) {
  try {
    const data = await db
      .selectDistinct()
      .from(friend)
      .where(
        or(
          and(eq(friend.userId, userId), eq(friend.friendId, friendId)),
          and(eq(friend.userId, friendId), eq(friend.friendId, userId))
        )
      );
    if (data && data.length > 0) return true;
    return false;
  } catch (error) {
    friendServiceLogger.error(error, "Error while verifying friend.");
    return false;
  }
}

export async function getFriends(userId: string) {
  try {
    const data = await db
      .selectDistinct()
      .from(friend)
      .where(or(eq(friend.userId, userId), eq(friend.friendId, userId)));
    return { success: true, data };
  } catch (error) {
    friendServiceLogger.error(error, "Error while fetching friend.");
    return { success: false, error };
  }
}
