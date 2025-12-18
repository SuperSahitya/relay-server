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
import {
  registerChatHandlers,
  registerPresenceHandlers,
  initializePresenceSubscription,
} from "./sockets/handlers";
import { authLimiter, generalLimiter } from "./middlewares/rateLimit";
import { errorMiddleware } from "./middlewares/error";
import friendRouter from "./routes/friendRouter";
import messageRouter from "./routes/messageRouter";
import searchRouter from "./routes/searchRouter";
import userRouter from "./routes/userRouter";
import {
  redis,
  redisSub,
  redisPub,
  removeUserSocket,
  setUserSocket,
  setUserOnline,
  setUserOffline,
} from "./lib/redis";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  createTopics,
  initializeProducer,
  producer,
  consumer,
  disconnectConsumer,
  disconnectProducer,
} from "./kafka";
import { startMessageConsumer } from "./services/messageService";
import { pool } from "./db/db";

let shuttingDown = false;
let isReady = false;

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
    if (redisSub.status === "wait") {
      await redisSub.connect();
    }
    if (redisPub.status === "wait") {
      await redisPub.connect();
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

    apiRouter.get("/health", (req: Request, res: Response) => {
      res.status(200).json({ status: "ok", ready: isReady });
    });

    apiRouter.get("/ready", (req: Request, res: Response) => {
      if (shuttingDown || !isReady) {
        return res.status(503).json({ status: "not ready" });
      }
      res.status(200).json({ status: "ready" });
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

      await setUserOnline(authSocket.userId);

      registerChatHandlers(io, authSocket);
      registerPresenceHandlers(io, authSocket);

      socket.on("disconnect", async () => {
        socketLogger.info(`User disconnected`);
        await removeUserSocket(authSocket.userId);
        await setUserOffline(authSocket.userId);
      });
    });

    initializePresenceSubscription(io);

    const server = httpServer.listen(PORT, () => {
      isReady = true;
      logger.info(
        {
          port: PORT,
          environment: process.env.NODE_ENV || "development",
          nodeVersion: process.version,
        },
        "Server started successfully"
      );
    });

    const gracefulShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      isReady = false;
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      const forceShutdownTimeout = setTimeout(() => {
        logger.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 30000);

      try {
        logger.info("Stopping HTTP server from accepting new connections...");
        await new Promise<void>((resolve) => {
          server.close(() => {
            logger.info(
              "HTTP server closed - all in-flight requests completed."
            );
            resolve();
          });
        });
        logger.info("Stopping Kafka consumer gracefully...");
        try {
          await disconnectConsumer();
          logger.info("Kafka consumer stopped and disconnected.");
        } catch (err) {
          logger.error({ err }, "Error stopping Kafka consumer");
        }

        logger.info("Disconnecting Kafka producer...");
        try {
          await disconnectProducer();
          logger.info("Kafka producer disconnected.");
        } catch (err) {
          logger.error({ err }, "Error disconnecting Kafka producer");
        }

        logger.info("Closing Socket.IO connections...");
        const sockets = await io.fetchSockets();
        logger.info(
          { count: sockets.length },
          "Disconnecting Socket.IO clients"
        );
        await Promise.all(
          sockets.map(async (socket) => {
            socket.disconnect(true);
          })
        );
        io.close(() => {
          logger.info("Socket.IO server closed.");
        });

        logger.info("Closing Redis connections...");
        const redisClients = [redis, subClient, redisPub, redisSub];
        await Promise.allSettled(
          redisClients.map(async (client) => {
            if (client.status === "ready") {
              await client.quit();
            }
          })
        );
        logger.info("Redis connections closed.");

        logger.info("Closing database pool...");
        await pool.end();
        logger.info("Database pool closed.");

        clearTimeout(forceShutdownTimeout);
        logger.info("Graceful shutdown completed successfully.");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during graceful shutdown");
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    console.error("Error details:", error);
    process.exit(1);
  }
}

startServer();
