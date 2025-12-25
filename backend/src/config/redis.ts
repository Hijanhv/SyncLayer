import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const createRedisClient = () => {
  return new Redis({
    host: process.env.REDISHOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
  });
};
