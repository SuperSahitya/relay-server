import RedisClient from "ioredis";
import logger from './logger';

const redisLogger = logger.child({ module: 'redis' });

export const redis = new RedisClient(process.env.REDIS_URL!);

redis.on('error', (err) => redisLogger.error({ err }, 'Redis error'));
redis.on('connect', () => redisLogger.info('Redis connected'));

export async function setUserSocket(userId: string, socketId: string) {
  await redis.set(`user:${userId}:socket`, socketId);
  redisLogger.debug({ userId, socketId }, 'User socket mapped');
}

export async function getUserSocket(userId: string): Promise<string | null> {
  return await redis.get(`user:${userId}:socket`);
}

export async function removeUserSocket(userId: string) {
  await redis.del(`user:${userId}:socket`);
  redisLogger.debug({ userId }, 'User socket removed');
}

export async function setUserStatus(userId: string, status: 'online' | 'away' | 'offline') {
  await redis.set(`user:${userId}:status`, status, 'EX', 3600);
}

export async function setUserTyping(receiverId: string, userId: string, isTyping: boolean) {
  const key = `room:${receiverId}:typing:${userId}`;
  if (isTyping) {
    await redis.set(key, '1', 'EX', 5);
  } else {
    await redis.del(key);
  }
}
