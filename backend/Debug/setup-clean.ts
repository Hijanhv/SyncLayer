import { createDatabasePool } from '../src/config/database.js';
import { createSheetsClient } from '../src/config/sheets.js';
import { SheetService } from '../src/services/sheet.service.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function cleanSetup() {
  console.log('🧹 Starting clean setup...\n');
  
  try {
    // 1. Clear database
    console.log('1️⃣ Clearing database...');
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'root',
      database: process.env.DATABASE_NAME || 'synclayer',
    });
    
    await connection.query('TRUNCATE TABLE sync_data');
    console.log('✅ Database cleared');
    
    // 2. Clear Google Sheet (keep headers)
    console.log('\n2️⃣ Clearing Google Sheet...');
    const sheets = createSheetsClient();
    const sheetService = new SheetService(sheets);
    
    // Ensure headers exist
    await sheetService.ensureHeaders();
    
    // Get all rows
    const rows = await sheetService.getAllRows();
    
    if (rows.length > 0) {
      // Clear all data rows (keep header)
      const clearRange = 'Sheet1!A2:G1000';
      await sheets.spreadsheets.values.clear({
        spreadsheetId: process.env.GOOGLE_SHEETS_SHEET_ID || '',
        range: clearRange,
      });
      console.log(`✅ Cleared ${rows.length} rows from sheet`);
    } else {
      console.log('✅ Sheet already empty');
    }
    
    // 3. Add test data to database
    console.log('\n3️⃣ Adding test data to database...');
    
    const testData = [
      {
        id: (Date.now() - 1000).toString(),
        name: 'Alice Johnson',
        email: 'alice@example.com',
        status: 'active',
        version: 1,
        updated_at: new Date(Date.now() - 1000).toISOString(),
        last_updated_by: 'db' as const
      },
      {
        id: Date.now().toString(),
        name: 'Bob Smith',
        email: 'bob@example.com',
        status: 'pending',
        version: 1,
        updated_at: new Date().toISOString(),
        last_updated_by: 'db' as const
      }
    ];
    
    for (const row of testData) {
      await connection.query(
        `INSERT INTO sync_data (id, name, email, status, version, updated_at, last_updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.email, row.status, row.version, 
         row.updated_at.slice(0, 19).replace('T', ' '), row.last_updated_by]
      );
    }
    
    console.log('✅ Added 2 test records to database');
    
    await connection.end();
    
    // 4. Trigger sync to populate sheet
    console.log('\n4️⃣ Triggering sync to populate Google Sheet...');
    
    // Create sync engine to manually sync
    const dbPool = createDatabasePool();
    const { DatabaseService } = await import('../src/services/database.service.js');
    const { SyncEngine } = await import('../src/services/sync.engine.js');
    
    const dbService = new DatabaseService(dbPool);
    const syncEngine = new SyncEngine(sheetService, dbService);
    
    const logs = await syncEngine.performSync();
    console.log(`✅ Sync completed: ${logs.length} operations`);
    
    logs.forEach(log => {
      console.log(`   ${log.details}`);
    });
    
    // 5. Verify
    console.log('\n5️⃣ Verifying setup...');
    
    const finalDbRows = await dbService.getAllRows();
    const finalSheetRows = await sheetService.getAllRows();
    
    console.log(`Database rows: ${finalDbRows.length}`);
    console.log(`Sheet rows: ${finalSheetRows.length}`);
    
    if (finalDbRows.length === finalSheetRows.length && finalDbRows.length === 2) {
      console.log('✅ Setup successful! Data is synchronized.');
    } else {
      console.log('⚠️  Data mismatch. Please check logs above.');
    }
    
    console.log('\n📋 Next steps:');
    console.log('1. Check database: curl http://localhost:3000/api/data/db');
    console.log('2. Check sheet: curl http://localhost:3000/api/data/sheet');
    console.log('3. Open frontend: http://localhost:5173');
    console.log('4. Edit in Google Sheet and watch changes sync');
    console.log('5. Edit via API and watch changes sync');
    
  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
  }
}

cleanSetup();