import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const createRedisClient = () => {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  
  return new Redis({
    host: process.env.REDISHOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDISPORT || process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
  });
};
