import { and, eq, or, inArray, like, aliasedTable } from "drizzle-orm";
import { db } from "../db/db";
import { friend, user, friendRequest } from "../db/schema";
import logger from "../lib/logger";
import { getUserById } from "./userService";

const friendServiceLogger = logger.child({ module: "friendServiceLogger" });

const orderUsers = (userA: string, userB: string) => {
  return userA < userB ? { userA, userB } : { userB, userA };
};

export async function sendFriendRequest(senderId: string, receiverId: string) {
  try {
    if (senderId === receiverId) {
      return { success: false, message: "Cannot send request to yourself." };
    }

    const friendExists = await getUserById(receiverId);
    if (!friendExists) {
      return { success: false, message: "User not found." };
    }

    const alreadyFriends = await verifyFriends(senderId, receiverId);
    if (alreadyFriends) {
      return { success: false, message: "Already friends." };
    }

    const existing = await db
      .select()
      .from(friendRequest)
      .where(
        or(
          and(
            eq(friendRequest.senderId, senderId),
            eq(friendRequest.receiverId, receiverId)
          ),
          and(
            eq(friendRequest.senderId, receiverId),
            eq(friendRequest.receiverId, senderId)
          )
        )
      );
    if (existing.length > 0) {
      return { success: false, message: "Friend request already exists." };
    }
    await db
      .insert(friendRequest)
      .values({ senderId: senderId, receiverId: receiverId });
    return { success: true, message: "Friend request sent successfully." };
  } catch (error) {
    // issues might arise if both user send request are sent at the same time
    friendServiceLogger.error(error, "Error while sending friend request.");
    return { success: false, error };
  }
}

export async function handleFriendRequest(
  senderId: string,
  receiverId: string,
  status: "accepted" | "declined"
) {
  try {
    const existingRequest = await db
      .select()
      .from(friendRequest)
      .where(
        and(
          eq(friendRequest.senderId, senderId),
          eq(friendRequest.receiverId, receiverId),
          eq(friendRequest.status, "pending")
        )
      );

    if (existingRequest.length === 0) {
      return {
        success: false,
        message: "Friend request not found or already handled.",
      };
    }

    const { userA, userB } = orderUsers(senderId, receiverId);

    await db.transaction(async (tx) => {
      await tx
        .update(friendRequest)
        .set({ status })
        .where(
          and(
            eq(friendRequest.senderId, senderId),
            eq(friendRequest.receiverId, receiverId)
          )
        );

      if (status === "accepted") {
        await tx.insert(friend).values({ userA, userB });
      }
    });

    return { success: true, message: `Friend request ${status}.` };
  } catch (error) {
    friendServiceLogger.error(error, "Error while handling friend request.");
    return { success: false, error };
  }
}

export async function deleteFriend(senderId: string, receiverId: string) {
  try {
    const { userA, userB } = orderUsers(senderId, receiverId);

    const friendshipExists = await verifyFriends(senderId, receiverId);
    if (!friendshipExists) {
      return { success: false, message: "Friendship does not exist." };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(friend)
        .where(and(eq(friend.userA, userA), eq(friend.userB, userB)));

      await tx
        .delete(friendRequest)
        .where(
          or(
            and(
              eq(friendRequest.senderId, senderId),
              eq(friendRequest.receiverId, receiverId)
            ),
            and(
              eq(friendRequest.senderId, receiverId),
              eq(friendRequest.receiverId, senderId)
            )
          )
        );
    });

    return { success: true };
  } catch (error) {
    friendServiceLogger.error(error, "Error while removing friend.");
    return { success: false, error };
  }
}

export async function verifyFriends(senderId: string, receiverId: string) {
  try {
    const { userA, userB } = orderUsers(senderId, receiverId);
    const data = await db
      .selectDistinct()
      .from(friend)
      .where(and(eq(friend.userA, userA), eq(friend.userB, userB)));
    return data && data.length > 0;
  } catch (error) {
    friendServiceLogger.error(error, "Error while verifying friend.");
    return false;
  }
}

export async function getFriends(userId: string) {
  try {
    const friendsAsUserA = await db
      .select({ friendData: user })
      .from(friend)
      .innerJoin(user, eq(friend.userB, user.id))
      .where(eq(friend.userA, userId));

    const friendsAsUserB = await db
      .select({ friendData: user })
      .from(friend)
      .innerJoin(user, eq(friend.userA, user.id))
      .where(eq(friend.userB, userId));

    const allFriends = [
      ...friendsAsUserA.map((f) => f.friendData),
      ...friendsAsUserB.map((f) => f.friendData),
    ];

    return { success: true, data: allFriends };
  } catch (error) {
    friendServiceLogger.error({ error }, "Error while fetching friends.");
    return { success: false, message: "Failed to fetch friends." };
  }
}

export async function getReceivedFriendRequests(userId: string) {
  try {
    const senderAlias = aliasedTable(user, "sender");
    const receiverAlias = aliasedTable(user, "receiver");

    const requests = await db
      .select({
        friendRequest: friendRequest,
        sender: senderAlias,
        receiver: receiverAlias,
      })
      .from(friendRequest)
      .innerJoin(senderAlias, eq(friendRequest.senderId, senderAlias.id))
      .innerJoin(receiverAlias, eq(friendRequest.receiverId, receiverAlias.id))
      .where(
        and(
          eq(friendRequest.receiverId, userId),
          eq(friendRequest.status, "pending")
        )
      );

    const formatted = requests.map((r) => ({
      ...r.friendRequest,
      sender: r.sender,
      receiver: r.receiver,
    }));

    return { success: true, data: formatted };
  } catch (error) {
    friendServiceLogger.error(
      { userId, error },
      "Error occurred while fetching received friend requests"
    );
    return {
      success: false,
      message: "Error occurred while fetching received friend requests",
    };
  }
}

export async function getSentFriendRequests(userId: string) {
  try {
    const senderAlias = aliasedTable(user, "sender");
    const receiverAlias = aliasedTable(user, "receiver");

    const requests = await db
      .select({
        friendRequest: friendRequest,
        sender: senderAlias,
        receiver: receiverAlias,
      })
      .from(friendRequest)
      .innerJoin(senderAlias, eq(friendRequest.senderId, senderAlias.id))
      .innerJoin(receiverAlias, eq(friendRequest.receiverId, receiverAlias.id))
      .where(
        and(
          eq(friendRequest.senderId, userId),
          eq(friendRequest.status, "pending")
        )
      );

    const formatted = requests.map((r) => ({
      ...r.friendRequest,
      sender: r.sender,
      receiver: r.receiver,
    }));

    return { success: true, data: formatted };
  } catch (error) {
    friendServiceLogger.error(
      { userId, error },
      "Error occurred while fetching sent friend requests"
    );
    return {
      success: false,
      message: "Error occurred while fetching sent friend requests",
    };
  }
}
