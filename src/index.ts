import express, { Request, Response, Router } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import "dotenv/config";
import cors from "cors";
import { auth } from "./auth/authConfig";
import logger from "./lib/logger";
import { authMiddleware } from "./middlewares/auth";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { socketAuthMiddleware } from "./middlewares/socketAuth";
import { AuthenticatedSocket } from "./types";
import { registerChatHandlers, registerRoomHandler } from "./sockets/handlers";

const PORT = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",");

const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? ALLOWED_ORIGINS
        : "http://localhost:3000",
    credentials: true,
  },
});

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ALLOWED_ORIGINS
        : "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.all("/api/auth/{*any}", toNodeHandler(auth));

app.use(express.json());

io.use(socketAuthMiddleware);

const apiRouter = Router();

apiRouter.get("/", (req: Request, res: Response) => {
  res.json({ status: `server live at PORT:${PORT}` });
});

app.use("/api/v1", apiRouter);

io.on("connection", (socket: Socket) => {
  const authSocket = socket as AuthenticatedSocket;
  const socketLogger = logger.child({
    module: "socketConnection",
    userId: authSocket.userId,
    email: authSocket.email,
    socketId: authSocket.id,
  });

  socketLogger.info(`Authenticated user connected`);

  registerChatHandlers(io, authSocket);
  registerRoomHandler(io, authSocket);

  socket.on("disconnect", () => {
    socketLogger.info(`User disconnected`);
  });
});

httpServer.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
    },
    "Server started successfully"
  );
});
