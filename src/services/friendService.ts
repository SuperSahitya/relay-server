import { and, eq, or, inArray, like } from "drizzle-orm";
import { db } from "../db/db";
import { friend, user, friendRequest } from "../db/schema";
import logger from "../lib/logger";

const friendServiceLogger = logger.child({ module: "friendServiceLogger" });

export async function sendFriendRequest(userId: string, friendId: string) {
  try {
    if (userId === friendId) {
      return { success: false, message: "Cannot send request to yourself." };
    }
    const alreadyFriends = await verifyFriends(userId, friendId);
    if (alreadyFriends) {
      return { success: false, message: "Already friends." };
    }
    const existing = await db
      .select()
      .from(friendRequest)
      .where(
        or(
          and(
            eq(friendRequest.userId, userId),
            eq(friendRequest.friendId, friendId)
          ),
          and(
            eq(friendRequest.userId, friendId),
            eq(friendRequest.friendId, userId)
          )
        )
      );
    if (existing.length > 0) {
      return { success: false, message: "Friend request already exists." };
    }
    const data = await db.insert(friendRequest).values({ userId, friendId });
    return { success: true, data };
  } catch (error) {
    friendServiceLogger.error(error, "Error while sending friend request.");
    return { success: false, error };
  }
}

export async function handleFriendRequest(
  userId: string,
  friendId: string,
  status: "pending" | "accepted" | "declined"
) {
  try {
    await db
      .update(friendRequest)
      .set({ status })
      .where(
        and(
          eq(friendRequest.userId, friendId),
          eq(friendRequest.friendId, userId)
        )
      );
    if (status === "accepted") {
      await db.insert(friend).values({ userId, friendId });
    }
    return { success: true };
  } catch (error) {
    friendServiceLogger.error(error, "Error while handling friend request.");
    return { success: false, error };
  }
}

export async function removeUser(userId: string, friendId: string) {
  try {
    await db
      .delete(friend)
      .where(
        or(
          and(eq(friend.userId, userId), eq(friend.friendId, friendId)),
          and(eq(friend.userId, friendId), eq(friend.friendId, userId))
        )
      );
    return { success: true };
  } catch (error) {
    friendServiceLogger.error(error, "Error while removing friend.");
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

    const friendIds = data.map((d) =>
      d.userId === userId ? d.friendId : d.userId
    );
    if (friendIds.length === 0) return { success: true, data: [] };

    const friends = await db
      .selectDistinct()
      .from(user)
      .where(inArray(user.id, friendIds));

    return { success: true, data: friends };
  } catch (error) {
    friendServiceLogger.error(error, "Error while fetching friends.");
    return { success: false, error };
  }
}

export async function searchFriend(userId: string, query: string) {
  try {
    const data = await db
      .selectDistinct()
      .from(friend)
      .where(or(eq(friend.userId, userId), eq(friend.friendId, userId)));

    const friendIds = data.map((d) =>
      d.userId === userId ? d.friendId : d.userId
    );
    if (friendIds.length === 0) return { success: true, data: [] };

    const friends = await db
      .selectDistinct()
      .from(user)
      .where(
        and(
          inArray(user.id, friendIds),
          or(like(user.name, `%${query}%`), like(user.email, `%${query}%`))
        )
      );

    return { success: true, data: friends };
  } catch (error) {
    friendServiceLogger.error(error, "Error while searching friends.");
    return { success: false, error };
  }
}
