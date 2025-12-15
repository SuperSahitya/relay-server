import RedisClient from "ioredis";
import logger from "./logger";

const redisLogger = logger.child({ module: "redis" });

export const redis = new RedisClient(process.env.REDIS_URL!, {
  lazyConnect: true,
});

export const redisSub = new RedisClient(process.env.REDIS_URL!, {
  lazyConnect: true,
});

export const redisPub = new RedisClient(process.env.REDIS_URL!, {
  lazyConnect: true,
});

redis.on("error", (err) => redisLogger.error({ err }, "Redis error"));
redis.on("connect", () => redisLogger.info("Redis connected"));

redisSub.on("error", (err) => redisLogger.error({ err }, "Redis sub error"));
redisPub.on("error", (err) => redisLogger.error({ err }, "Redis pub error"));

export async function setUserSocket(userId: string, socketId: string) {
  await redis.set(`user:${userId}:socket`, socketId, "EX", 86400);
  redisLogger.debug({ userId, socketId }, "User socket mapped");
}

export async function getUserSocket(userId: string): Promise<string | null> {
  return await redis.get(`user:${userId}:socket`);
}

export async function removeUserSocket(userId: string) {
  await redis.del(`user:${userId}:socket`);
  redisLogger.debug({ userId }, "User socket removed");
}

const PRESENCE_SET_KEY = "presence:online";
const PRESENCE_CHANNEL = "presence:updates";
const HEARTBEAT_TTL = 60;

export async function setUserOnline(userId: string): Promise<boolean> {
  const pipeline = redis.pipeline();

  pipeline.sadd(PRESENCE_SET_KEY, userId);
  pipeline.set(
    `presence:user:${userId}:lastSeen`,
    Date.now().toString(),
    "EX",
    HEARTBEAT_TTL
  );

  await pipeline.exec();

  await redisPub.publish(
    PRESENCE_CHANNEL,
    JSON.stringify({
      userId,
      status: "online",
      timestamp: Date.now(),
    })
  );

  redisLogger.debug({ userId }, "User set online");
  return true;
}

export async function setUserOffline(userId: string): Promise<boolean> {
  const pipeline = redis.pipeline();

  pipeline.srem(PRESENCE_SET_KEY, userId);
  pipeline.del(`presence:user:${userId}:lastSeen`);

  await pipeline.exec();

  await redisPub.publish(
    PRESENCE_CHANNEL,
    JSON.stringify({
      userId,
      status: "offline",
      timestamp: Date.now(),
    })
  );

  redisLogger.debug({ userId }, "User set offline");
  return true;
}

export async function refreshUserHeartbeat(userId: string): Promise<void> {
  await redis.set(
    `presence:user:${userId}:lastSeen`,
    Date.now().toString(),
    "EX",
    HEARTBEAT_TTL
  );
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const isMember = await redis.sismember(PRESENCE_SET_KEY, userId);
  return isMember === 1;
}

export async function getOnlineUsers(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const pipeline = redis.pipeline();
  userIds.forEach((id) => pipeline.sismember(PRESENCE_SET_KEY, id));

  const results = await pipeline.exec();

  return userIds.filter((_, index) => {
    const result = results?.[index];
    return result && result[1] === 1;
  });
}

export async function getAllOnlineUsers(): Promise<string[]> {
  return await redis.smembers(PRESENCE_SET_KEY);
}

export function subscribeToPresenceUpdates(
  callback: (data: {
    userId: string;
    status: "online" | "offline";
    timestamp: number;
  }) => void
): void {
  redisSub.subscribe(PRESENCE_CHANNEL, (err) => {
    if (err) {
      redisLogger.error({ err }, "Failed to subscribe to presence channel");
    } else {
      redisLogger.info("Subscribed to presence updates");
    }
  });

  redisSub.on("message", (channel, message) => {
    if (channel === PRESENCE_CHANNEL) {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (err) {
        redisLogger.error({ err, message }, "Failed to parse presence update");
      }
    }
  });
}

export async function setUserTyping(
  receiverId: string,
  userId: string,
  isTyping: boolean
) {
  const key = `room:${receiverId}:typing:${userId}`;
  if (isTyping) {
    await redis.set(key, "1", "EX", 5);
  } else {
    await redis.del(key);
  }
}
