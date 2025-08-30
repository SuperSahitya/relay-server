import { Socket } from "socket.io";
import logger from "../lib/logger";
import { auth } from "../auth/authConfig";
import { fromNodeHeaders } from "better-auth/node";
import { AuthenticatedSocket } from "../types";

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  const socketMiddlewareLogger = logger.child({
    module: "socketAuthMiddleware",
    socketId: socket.id,
  });
  try {
    // socketMiddlewareLogger.info(socket.handshake.headers);
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) {
      return next(new Error("No authentication"));
    }

    const session = await auth.api.getSession({
      headers: fromNodeHeaders({ cookie: cookies }),
    });

    if (!session?.user) {
      return next(new Error("Authentication failed"));
    }

    (socket as AuthenticatedSocket).userId = session.user.id;
    (socket as AuthenticatedSocket).email = session.user.email;
    next();
  } catch (error) {
    socketMiddlewareLogger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Socket authentication error"
    );
    next(new Error("Authentication failed"));
  }
};
