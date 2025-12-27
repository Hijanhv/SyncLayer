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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Application state
let syncEngine: SyncEngine | null = null;
let syncQueue: SyncQueue | null = null;
let syncInterval: NodeJS.Timeout | null = null;
let isShuttingDown = false;

// ==================== HELPER FUNCTIONS ====================

/**
 * Wait for database connection with retry logic
 */
async function waitForDatabase(maxRetries = 30, delay = 2000) {
  const mysql = await import('mysql2/promise');
  
  const dbConfig = {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || 'root',
    database: process.env.DATABASE_NAME || 'synclayer',
    connectTimeout: 10000,
  };

  console.log('🔌 Database configuration:', { 
    ...dbConfig, 
    password: '***'
  });

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`📡 Attempting database connection (${i + 1}/${maxRetries})...`);
      
      // Try to connect without specifying database first
      const testConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        connectTimeout: dbConfig.connectTimeout,
      });

      // Test basic connection
      const [result] = await testConnection.query('SELECT 1 as test');
      console.log('✅ Basic database connection test passed:', result);
      
      // Check if database exists, create if not using simple query
      const [databases]: any = await testConnection.query(
        `SHOW DATABASES LIKE '${dbConfig.database}'`
      );
      
      if (databases.length === 0) {
        console.log(`📝 Creating database '${dbConfig.database}'...`);
        await testConnection.query(`CREATE DATABASE \`${dbConfig.database}\``);
        console.log(`✅ Database '${dbConfig.database}' created`);
      } else {
        console.log(`✅ Database '${dbConfig.database}' already exists`);
      }
      
      await testConnection.end();

      // Now test connection with the database
      const dbConnection = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        connectTimeout: dbConfig.connectTimeout,
      });

      await dbConnection.query('SELECT 1');
      await dbConnection.end();

      console.log('✅ Database connection fully established');
      
      // Create the actual pool for application use
      return createDatabasePool();
    } catch (error: any) {
      if (i === maxRetries - 1) {
        console.error('❌ Max retries reached. Database connection failed.');
        console.error('Error details:', error);
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      console.log(`⏳ Database not ready. Retrying in ${delay/1000}s... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Database connection failed');
}

/**
 * Wait for Redis connection
 */
async function waitForRedis(maxRetries = 10, delay = 1000): Promise<any> {
  return new Promise((resolve, reject) => {
    const redis = createRedisClient();
    let retries = 0;

    const attemptConnection = () => {
      console.log(`🔌 Attempting Redis connection (${retries + 1}/${maxRetries})...`);
      
      redis.ping((err, result) => {
        if (err) {
          retries++;
          if (retries >= maxRetries) {
            redis.quit();
            reject(new Error(`Redis connection failed after ${maxRetries} attempts: ${err.message}`));
            return;
          }
          
          console.log(`⏳ Redis not ready. Retrying in ${delay/1000}s... Error: ${err.message}`);
          setTimeout(attemptConnection, delay);
          return;
        }
        
        console.log('✅ Redis connected:', result);
        resolve(redis);
      });
    };

    attemptConnection();
  });
}

/**
 * Initialize Google Sheets service
 */
async function initializeSheets() {
  try {
    const sheets = createSheetsClient();
    const sheetService = new SheetService(sheets);
    
    await sheetService.ensureHeaders();
    console.log('✅ Google Sheets initialized');
    
    return { sheets, sheetService };
  } catch (error: any) {
    console.warn('⚠️ Google Sheets initialization failed:', error.message);
    console.log('📝 Note: You can still use the app without Google Sheets');
    
    return { 
      sheets: null, 
      sheetService: null 
    };
  }
}

/**
 * Start sync polling
 */
function startPolling() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  const intervalMs = parseInt(process.env.SYNC_INTERVAL_MS || '30000');
  
  console.log(`⏱️ Starting sync polling every ${intervalMs}ms`);
  
  syncInterval = setInterval(async () => {
    try {
      if (syncQueue && !isShuttingDown) {
        await syncQueue.addSyncJob();
      }
    } catch (error: any) {
      console.error('🔄 Sync polling error:', error.message);
    }
  }, intervalMs);
}

// ==================== ROUTES ====================

// Health check endpoint
app.get('/health', async (req, res) => {
  const status: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
    uptime: process.uptime()
  };

  try {
    // Check database
    const mysql = await import('mysql2/promise');
    const testConn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'root',
      connectTimeout: 5000,
    });
    await testConn.query('SELECT 1');
    await testConn.end();
    status.services.database = 'healthy';
  } catch (dbError: any) {
    status.services.database = 'unhealthy';
    status.databaseError = dbError.message;
  }

  // Check Redis
  try {
    const redis = createRedisClient();
    await new Promise((resolve, reject) => {
      redis.ping((err) => {
        redis.quit();
        err ? reject(err) : resolve(null);
      });
    });
    status.services.redis = 'healthy';
  } catch (redisError: any) {
    status.services.redis = 'unhealthy';
    status.redisError = redisError.message;
  }

  // Check sheets
  status.services.sheets = SHEET_ID ? 'configured' : 'not_configured';
  
  // Determine overall status
  const unhealthyServices = Object.values(status.services).filter(s => s === 'unhealthy');
  status.overall = unhealthyServices.length === 0 ? 'healthy' : 'degraded';

  res.json(status);
});

// Test database endpoint
// Test database endpoint - FIXED: uses sync_data instead of contacts
app.get('/api/test/db', async (req, res) => {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'root',
      database: process.env.DATABASE_NAME || 'synclayer',
      connectTimeout: 5000,
    });

    const [tables]: any = await connection.query('SHOW TABLES');
    const [rows]: any = await connection.query('SELECT COUNT(*) as count FROM sync_data');
    
    await connection.end();

    res.json({
      success: true,
      database: process.env.DATABASE_NAME,
      tables: tables.map((t: any) => Object.values(t)[0]),
      recordCount: rows[0].count,
      message: 'Database connection is working!'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      suggestion: 'Check your .env file and ensure MySQL is running'
    });
  }
});

// System info endpoint
app.get('/api/system/info', (req, res) => {
  res.json({
    app: 'SyncLayer',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    syncInterval: process.env.SYNC_INTERVAL_MS || '30000'
  });
});

// Initialize sync routes when services are ready
function initializeSyncRoutes(dbService: DatabaseService, sheets: any, sheetService: any) {
  if (!syncEngine || !syncQueue) return;

  app.post('/api/sync/trigger', async (req, res) => {
    try {
      const job = await syncQueue!.addSyncJob();
      res.json({ 
        success: true, 
        jobId: job.id,
        message: 'Sync job queued successfully'
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get('/api/sync/logs', (req, res) => {
    const logs = syncEngine!.getSyncLogs();
    res.json({ 
      success: true, 
      logs,
      count: logs.length 
    });
  });

  app.get('/api/sync/stats', async (req, res) => {
    try {
      const stats = await syncQueue!.getQueueStats();
      res.json({ 
        success: true, 
        stats 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get('/api/data/sheet', async (req, res) => {
    try {
      if (!sheetService) {
        return res.status(400).json({
          success: false,
          error: 'Google Sheets service not initialized'
        });
      }
      const rows = await sheetService.getAllRows();
      res.json({ 
        success: true, 
        rows,
        count: rows.length 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.get('/api/data/db', async (req, res) => {
    try {
      const rows = await dbService.getAllRows();
      res.json({ 
        success: true, 
        rows,
        count: rows.length 
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
// Update record in database
app.put('/api/data/db/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status } = req.body;
    
    if (!name || !email || !status) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: name, email, status' 
      });
    }

    await dbService.updateRow(id, {
      name,
      email,
      status,
      version: 1, // Will be incremented in updateRow
      updated_at: new Date().toISOString(),
      last_updated_by: 'api'
    });

    res.json({ 
      success: true, 
      message: 'Record updated successfully',
      data: { id, name, email, status }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Delete record from database
app.delete('/api/data/db/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await dbService.deleteRow(id);

    res.json({ 
      success: true, 
      message: 'Record deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

  app.post('/api/data/db', async (req, res) => {
    try {
      const { name, email, status } = req.body;
      
      if (!name || !email || !status) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing required fields: name, email, status' 
        });
      }

      await dbService.createRow({
        name,
        email,
        status,
        version: 1,
        updated_at: new Date().toISOString(),
        last_updated_by:'db'
      });

      res.json({ 
        success: true, 
        message: 'Record added successfully',
        data: { name, email, status }
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });
}

// ==================== MAIN BOOTSTRAP ====================

async function bootstrap() {
  try {
    console.log('🚀 Starting SyncLayer Backend...');
    console.log('='.repeat(50));
    
    // Step 1: Wait for and initialize database
    console.log('\n📦 Step 1: Initializing Database...');
    const dbPool = await waitForDatabase();
    await initializeDatabase(dbPool);
    const dbService = new DatabaseService(dbPool);
    console.log('✅ Database ready');

    // Step 2: Initialize Redis
    console.log('\n🔴 Step 2: Initializing Redis...');
    const redis = await waitForRedis();
    console.log('✅ Redis ready');

    // Step 3: Initialize Google Sheets
    console.log('\n📊 Step 3: Initializing Google Sheets...');
    const { sheets, sheetService } = await initializeSheets();
    
    // Step 4: Initialize Sync Engine
    console.log('\n🔄 Step 4: Initializing Sync Engine...');
    if (sheetService) {
      syncEngine = new SyncEngine(sheetService, dbService);
      syncQueue = new SyncQueue(syncEngine, redis);
      console.log('✅ Sync Engine ready');
    } else {
      console.log('⚠️ Sync Engine disabled - Google Sheets not configured');
    }

    // Step 5: Initialize routes
    console.log('\n🌐 Step 5: Initializing Routes...');
    initializeSyncRoutes(dbService, sheets, sheetService);
    console.log('✅ Routes ready');

    // Step 6: Start polling
    if (syncEngine && syncQueue) {
      startPolling();
    }

    // Step 7: Start server
    console.log('\n🚪 Step 6: Starting Server...');
    const server = app.listen(PORT, () => {
      console.log('='.repeat(50));
      console.log(`✅ SyncLayer Backend is running!`);
      console.log(`📍 Local: http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🧪 Test DB: http://localhost:${PORT}/api/test/db`);
      console.log(`📋 System: http://localhost:${PORT}/api/system/info`);
      if (SHEET_ID) {
        console.log(`📊 Google Sheet ID: ${SHEET_ID}`);
      }
      console.log('='.repeat(50));
    });

    // Graceful shutdown handler
    const gracefulShutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      console.log('\n🛑 Received shutdown signal...');
      
      if (syncInterval) {
        clearInterval(syncInterval);
        console.log('⏹️  Sync polling stopped');
      }
      
      if (syncQueue) {
        await syncQueue.close();
        console.log('⏹️  Sync queue closed');
      }
      
      server.close(() => {
        console.log('✅ HTTP server closed');
        console.log('👋 Goodbye!');
        process.exit(0);
      });
      
      setTimeout(() => {
        console.error('❌ Could not close gracefully, forcing shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown);

  } catch (error: any) {
    console.error('\n❌ Fatal error during bootstrap:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🔧 Debugging Tips:');
    console.log('1. Check MySQL: docker ps | grep mysql');
    console.log('2. Test connection: mysql -h 127.0.0.1 -P 3306 -u root -p');
    console.log('3. View logs: docker logs mysql');
    console.log('4. Check .env file');
    
    process.exit(1);
  }
}

// Start the application
bootstrap();

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});