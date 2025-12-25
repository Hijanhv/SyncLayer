import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { SyncEngine } from '../services/sync.engine.js';
import { SyncLog } from '../types/index.js';

export class SyncQueue {
  private queue: Queue;
  private worker: Worker;
  private syncEngine: SyncEngine;
  private redis: Redis;

  constructor(syncEngine: SyncEngine, redis: Redis) {
    this.syncEngine = syncEngine;
    this.redis = redis;

    this.queue = new Queue('sync-queue', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 50,
        },
      },
    });

    this.worker = new Worker(
      'sync-queue',
      async (job: Job) => {
        return await this.processSyncJob(job);
      },
      {
        connection: redis.duplicate(),
        concurrency: 1,
      }
    );

    this.setupWorkerEventHandlers();
  }

  private async processSyncJob(job: Job): Promise<SyncLog[]> {
    console.log(`[Worker] Processing sync job ${job.id}`);
    
    try {
      const logs = await this.syncEngine.performSync();
      console.log(`[Worker] Sync completed: ${logs.length} operations`);
      return logs;
    } catch (error) {
      console.error(`[Worker] Sync failed:`, error);
      throw error;
    }
  }

  private setupWorkerEventHandlers() {
    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  async addSyncJob(): Promise<Job> {
    const job = await this.queue.add(
      'sync',
      {},
      {
        jobId: `sync-${Date.now()}`,
      }
    );

    console.log(`📋 Queued sync job ${job.id}`);
    return job;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  async close() {
    await this.worker.close();
    await this.queue.close();
  }
}
