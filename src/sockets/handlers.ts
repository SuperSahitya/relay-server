import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../types";
import logger from "../lib/logger";

export function registerChatHandlers(io: Server, socket: AuthenticatedSocket) {
  const chatLogger = logger.child({
    module: "chatHandlers",
    socketId: socket.id,
    userEmail: socket.email,
  });

  socket.on("chat_message", ({ roomId, message }) => {
    if (!roomId || !message?.trim()) {
      chatLogger.warn({ roomId, message }, "Invalid chat message received");
      return;
    }

    chatLogger.info(
      {
        roomId,
        message: message.trim(),
        sender: socket.email,
      },
      "Chat message received"
    );

    const messageData = {
      id: Date.now().toString(),
      message: message.trim(),
      sender: socket.email,
      timestamp: new Date().toISOString(),
    };

    io.to(roomId).emit("chat_message", messageData);

    chatLogger.debug(
      {
        messageId: messageData.id,
        roomId,
      },
      "Chat message broadcasted to room"
    );
  });
}

export function registerRoomHandler(io: Server, socket: AuthenticatedSocket) {
  socket.on("join_room", (roomId: string) => {
    socket.join(roomId);
    console.log(`${socket.email} joined room ${roomId}`);

    socket.to(roomId).emit("system_message", {
      message: `${socket.email} joined the room`,
      timestamp: new Date().toISOString(),
    });

    socket.emit("system_message", {
      message: `You joined room: ${roomId}`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("leave_room", (roomId: string) => {
    socket.leave(roomId);
    console.log(`${socket.email} left room ${roomId}`);

    socket.to(roomId).emit("system_message", {
      message: `${socket.email} left the room`,
      timestamp: new Date().toISOString(),
    });
  });
}


