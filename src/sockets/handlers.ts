import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../types";
import logger from "../lib/logger";
import { kafka } from "../kafka";
import { Producer } from "kafkajs";

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  const chatLogger = logger.child({
    module: "chatHandlers",
    socketId: socket.id,
    userEmail: socket.email,
  });

  socket.on("chat_message", ({ receiverId, message }) => {
    try {
      if (!receiverId || !message?.trim()) {
        chatLogger.warn(
          { receiverId, message },
          "Invalid chat message received"
        );
        return;
      }

      chatLogger.info(
        {
          receiverId,
          message: message.trim(),
          sender: socket.email,
          senderId: socket.userId
        },
        "Chat message received"
      );

      const messageData = {
        id: Date.now().toString(),
        message: message.trim(),
        sender: socket.email,
        timestamp: new Date().toISOString(),
      };

      io.to(receiverId).emit("chat_message", messageData);

      chatLogger.debug(
        {
          messageId: messageData.id,
          receiverId,
        },
        "Chat message broadcasted to room"
      );
    } catch (error) {
      chatLogger.error(
        { senderId: socket.id, receiverId, message },
        "Error while sending message"
      );
    }
  });
}