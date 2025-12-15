import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../types";
import logger from "../lib/logger";
import { producer } from "../kafka";
import {
  getOnlineUsers,
  getUserSocket,
  redis,
  refreshUserHeartbeat,
  setUserOffline,
  setUserOnline,
  subscribeToPresenceUpdates,
} from "../lib/redis";
import { getFriends } from "../services/friendService";
import { getFriendIds } from "../services/friendService";

// Heartbeat interval in ms (should be less than HEARTBEAT_TTL in redis.ts)
const HEARTBEAT_INTERVAL = 30000;

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  const chatLogger = logger.child({
    module: "chatHandlers",
    socketId: socket.id,
    userEmail: socket.email,
  });

  socket.on("chat_message", async ({ receiverId, message }, callback) => {
    try {
      if (!receiverId || !message?.trim()) {
        chatLogger.warn(
          { receiverId, message },
          "Invalid chat message received"
        );
        if (typeof callback === "function") {
          callback({ success: false, error: "Invalid message or receiver" });
        }
        return;
      }

      chatLogger.info(
        {
          receiverId,
          message: message.trim(),
          sender: socket.email,
          senderId: socket.userId,
        },
        "Chat message received"
      );

      const conversationId = [receiverId, socket.userId].sort().join("_");

      const messageData = {
        conversationId,
        senderId: socket.userId,
        receiverId,
        message: message.trim(),
      };

      io.to(receiverId).emit("chat_message", messageData);

      await producer.send({
        topic: "chat-messages",
        messages: [
          {
            key: conversationId,
            value: JSON.stringify(messageData),
          },
        ],
      });

      chatLogger.debug(messageData, "Chat message broadcasted to room");

      if (typeof callback === "function") {
        callback({ success: true, data: messageData });
      }
    } catch (error) {
      chatLogger.error(
        { senderId: socket.id, receiverId, message },
        "Error while sending message"
      );
      if (typeof callback === "function") {
        callback({ success: false, error: "Failed to send message" });
      }
    }
  });
}

export function registerPresenceHandlers(
  io: Server,
  socket: AuthenticatedSocket
) {
  const presenceLogger = logger.child({
    module: "presenceHandlers",
    socketId: socket.id,
    userId: socket.userId,
  });

  const heartbeatTimer = setInterval(async () => {
    try {
      await refreshUserHeartbeat(socket.userId);
    } catch (error) {
      presenceLogger.error({ error }, "Failed to refresh heartbeat");
    }
  }, HEARTBEAT_INTERVAL);

  socket.on("disconnect", () => {
    clearInterval(heartbeatTimer);
  });

  socket.on("get_online_friends", async (callback) => {
    try {
      const friendIds = await getFriendIds(socket.userId);
      if (!friendIds.success || !friendIds.data) {
        if (typeof callback === "function") {
          callback({ success: false, error: "Failed to fetch friends" });
        }
        return;
      }

      const onlineFriendIds = await getOnlineUsers(friendIds.data);

      presenceLogger.debug(
        { onlineFriendIds, totalFriends: friendIds.data.length },
        "Fetched online friends"
      );

      if (typeof callback === "function") {
        callback({ success: true, data: onlineFriendIds });
      }
    } catch (error) {
      presenceLogger.error({ error }, "Error fetching online friends");
      if (typeof callback === "function") {
        callback({ success: false, error: "Failed to get online friends" });
      }
    }
  });

  socket.on("get_user_status", async ({ userId }, callback) => {
    try {
      const onlineUsers = await getOnlineUsers([userId]);
      const isOnline = onlineUsers.length > 0;

      if (typeof callback === "function") {
        callback({ success: true, data: { userId, isOnline } });
      }
    } catch (error) {
      presenceLogger.error({ error, userId }, "Error checking user status");
      if (typeof callback === "function") {
        callback({ success: false, error: "Failed to get user status" });
      }
    }
  });
}

export function initializePresenceSubscription(io: Server) {
  const presenceLogger = logger.child({ module: "presenceSubscription" });

  subscribeToPresenceUpdates(async (data) => {
    const { userId, status, timestamp } = data;

    presenceLogger.debug({ userId, status }, "Received presence update");

    const friendIds = await getFriendIds(userId);
    if (!friendIds.success || !friendIds.data) {
      return;
    }

    friendIds.data.forEach((friendId) => {
      io.to(friendId).emit("presence_update", {
        userId,
        status,
        timestamp,
      });
    });
  });

  presenceLogger.info("Presence subscription initialized");
}
