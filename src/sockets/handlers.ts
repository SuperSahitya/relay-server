import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../types";
import logger from "../lib/logger";
import { producer } from "../kafka";
import { redis } from "../lib/redis";

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
