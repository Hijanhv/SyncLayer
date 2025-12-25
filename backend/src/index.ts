import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createDatabasePool, initializeDatabase } from './config/database.js';
import { createRedisClient } from './config/redis.js';
import { createSheetsClient, SHEET_ID } from './config/sheets.js';
import { SheetService } from './services/sheet.service.js';
import { DatabaseService } from './services/database.service.js';
import { SyncEngine } from './services/sync.engine.js';
import { SyncQueue } from './workers/sync.worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for production
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

let syncEngine: SyncEngine;
let syncQueue: SyncQueue;
let syncInterval: NodeJS.Timeout;

async function bootstrap() {
  try {
    console.log('🚀 Initializing SyncLayer...');

    const dbPool = createDatabasePool();
    await initializeDatabase(dbPool);

    const redis = createRedisClient();
    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('❌ Redis error:', err));

    const sheets = createSheetsClient();
    
    const sheetService = new SheetService(sheets);
    const dbService = new DatabaseService(dbPool);
    
    await sheetService.ensureHeaders();
    console.log('✅ Sheet headers initialized');

    syncEngine = new SyncEngine(sheetService, dbService);
    syncQueue = new SyncQueue(syncEngine, redis);

    console.log('✅ Services initialized');
    console.log(`📊 Syncing with Sheet ID: ${SHEET_ID}`);

    startPolling();

    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    app.post('/api/sync/trigger', async (req, res) => {
      try {
        const job = await syncQueue.addSyncJob();
        res.json({ success: true, jobId: job.id });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.get('/api/sync/logs', (req, res) => {
      const logs = syncEngine.getSyncLogs();
      res.json({ logs });
    });

    app.get('/api/sync/stats', async (req, res) => {
      try {
        const stats = await syncQueue.getQueueStats();
        res.json({ stats });
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.get('/api/data/sheet', async (req, res) => {
      try {
        const sheetService = new SheetService(sheets);
        const rows = await sheetService.getAllRows();
        res.json({ rows });
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.get('/api/data/db', async (req, res) => {
      try {
        const rows = await dbService.getAllRows();
        res.json({ rows });
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.post('/api/data/db', async (req, res) => {
      try {
        const { name, email, status } = req.body;
        
        if (!name || !email || !status) {
          return res.status(400).json({ 
            error: 'Missing required fields: name, email, status' 
          });
        }

        await dbService.createRow({
          name,
          email,
          status,
          version: 1,
          updated_at: new Date().toISOString(),
          last_updated_by: 'db'
        });

        res.json({ success: true, message: 'Record added successfully' });
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

function startPolling() {
  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS || '3000');
  
  console.log(`⏱️  Starting sync polling every ${intervalMs}ms`);

  syncInterval = setInterval(async () => {
    try {
      await syncQueue.addSyncJob();
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, intervalMs);
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  clearInterval(syncInterval);
  if (syncQueue) {
    await syncQueue.close();
  }
  process.exit(0);
});

bootstrap();
