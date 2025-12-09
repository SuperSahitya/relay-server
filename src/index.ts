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
import { registerChatHandlers } from "./sockets/handlers";
import { authLimiter, generalLimiter } from "./middlewares/rateLimit";
import { errorMiddleware } from "./middlewares/error";
import friendRouter from "./routes/friendRouter";
import messageRouter from "./routes/messageRouter";
import searchRouter from "./routes/searchRouter";
import userRouter from "./routes/userRouter";
import { redis, removeUserSocket, setUserSocket } from "./lib/redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { createTopics, initializeProducer } from "./kafka";
import { startMessageConsumer } from "./services/messageService";

const PORT = process.env.PORT || 5000;
const app = express();
const httpServer = createServer(app);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",");

async function startServer() {
  try {
    const pubClient = redis;
    const subClient = redis.duplicate();

    logger.info("Connecting to Redis...");
    if (pubClient.status === "wait") {
      await pubClient.connect();
    }
    if (subClient.status === "wait") {
      await subClient.connect();
    }
    logger.info("Connected to Redis.");

    logger.info("Initializing Kafka Producer...");
    await initializeProducer();
    logger.info("Initialized Kafka Producer.");

    logger.info("Creating Kafka Topics...");
    await createTopics();
    logger.info("Created Kafka Topics.");

    logger.info("Starting Message Consumer...");
    await startMessageConsumer();
    logger.info("Started Message Consumer.");

    const io = new Server(httpServer, {
      cors: {
        origin:
          process.env.NODE_ENV === "production"
            ? ALLOWED_ORIGINS
            : "http://localhost:3000",
        credentials: true,
      },
      adapter: createAdapter(pubClient, subClient),
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

    app.use("/api/auth", authLimiter);

    app.all("/api/auth/{*any}", toNodeHandler(auth));

    app.use(generalLimiter);

    app.use(express.json());

    io.use(socketAuthMiddleware);

    const apiRouter = Router();

    apiRouter.get("/", (req: Request, res: Response) => {
      res.json({ status: `server live at PORT:${PORT}` });
    });

    apiRouter.use(friendRouter);
    apiRouter.use(messageRouter);
    apiRouter.use(searchRouter);
    apiRouter.use(userRouter);

    app.use("/api/v1", apiRouter);

    app.use(errorMiddleware);

    io.on("connection", async (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const socketLogger = logger.child({
        module: "socketConnection",
        userId: authSocket.userId,
        email: authSocket.email,
        socketId: authSocket.id,
      });

      socketLogger.info(`Authenticated user connected`);

      socket.join(authSocket.userId);

      await setUserSocket(authSocket.userId, authSocket.id);

      registerChatHandlers(io, authSocket);

      socket.on("disconnect", async () => {
        socketLogger.info(`User disconnected`);
        await removeUserSocket(authSocket.userId);
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
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    console.error("Error details:", error);
    process.exit(1);
  }
}

startServer();
