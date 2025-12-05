import { rateLimit } from "express-rate-limit";
import { RedisStore, type RedisReply } from "rate-limit-redis";
import logger from "../lib/logger";
import { redis } from "../lib/redis";

export const generalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW!),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
  }),
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        url: req.originalUrl,
      },
      "Rate limit exceeded"
    );

    res.status(429).json({
      error: "Too many requests, please try again later.",
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW!),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  store: new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
  }),
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(
      {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        url: req.originalUrl,
      },
      "Rate limit exceeded"
    );

    res.status(429).json({
      error: "Too many requests, please try again later.",
    });
  },
});
