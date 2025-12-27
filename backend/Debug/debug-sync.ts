import { createSheetsClient } from '../src/config/sheets.js';
import { SheetService } from '../src/services/sheet.service.js';
import { createDatabasePool } from '../src/config/database.js';
import { DatabaseService } from '../src/services/database.service.js';
import { SyncEngine } from '../src/services/sync.engine.js';

async function debugSync() {
  console.log('🔍 Debugging SyncLayer...\n');
  
  try {
    // 1. Initialize services
    console.log('1️⃣ Initializing services...');
    const sheets = createSheetsClient();
    const sheetService = new SheetService(sheets);
    
    const dbPool = createDatabasePool();
    const dbService = new DatabaseService(dbPool);
    
    const syncEngine = new SyncEngine(sheetService, dbService);
    
    // 2. Get current data
    console.log('\n2️⃣ Fetching current data...');
    const sheetRows = await sheetService.getAllRows();
    const dbRows = await dbService.getAllRows();
    
    console.log(`📄 Google Sheet rows: ${sheetRows.length}`);
    console.log(`🗄️  Database rows: ${dbRows.length}`);
    
    // 3. Show what we found
    console.log('\n3️⃣ Data comparison:');
    if (sheetRows.length > 0) {
      console.log('First sheet row:', JSON.stringify(sheetRows[0], null, 2));
    }
    if (dbRows.length > 0) {
      console.log('First DB row:', JSON.stringify(dbRows[0], null, 2));
    }
    
    // 4. Find differences
    console.log('\n4️⃣ Looking for differences...');
    const sheetIds = new Set(sheetRows.map(r => r.id));
    const dbIds = new Set(dbRows.map(r => r.id));
    
    const onlyInSheet = sheetRows.filter(r => !dbIds.has(r.id));
    const onlyInDb = dbRows.filter(r => !sheetIds.has(r.id));
    
    console.log(`Rows only in Sheet: ${onlyInSheet.length}`);
    console.log(`Rows only in DB: ${onlyInDb.length}`);
    
    if (onlyInSheet.length > 0) {
      console.log('Sheet-only IDs:', onlyInSheet.map(r => r.id));
    }
    if (onlyInDb.length > 0) {
      console.log('DB-only IDs:', onlyInDb.map(r => r.id));
    }
    
    // 5. Compare rows that exist in both
    const commonIds = [...sheetIds].filter(id => dbIds.has(id));
    console.log(`\nRows in both: ${commonIds.length}`);
    
    if (commonIds.length > 0) {
      const mismatches = [];
      for (const id of commonIds.slice(0, 5)) { // Check first 5
        const sheetRow = sheetRows.find(r => r.id === id)!;
        const dbRow = dbRows.find(r => r.id === id)!;
        
        if (sheetRow.name !== dbRow.name || 
            sheetRow.email !== dbRow.email || 
            sheetRow.status !== dbRow.status) {
          mismatches.push({
            id,
            sheet: { name: sheetRow.name, email: sheetRow.email, status: sheetRow.status },
            db: { name: dbRow.name, email: dbRow.email, status: dbRow.status }
          });
        }
      }
      
      console.log(`Mismatched rows: ${mismatches.length}`);
      if (mismatches.length > 0) {
        console.log('Sample mismatches:', mismatches[0]);
      }
    }
    
    // 6. Perform sync
    console.log('\n5️⃣ Performing sync...');
    const logs = await syncEngine.performSync();
    console.log(`Sync completed with ${logs.length} operations:`);
    
    logs.forEach(log => {
      console.log(`  ${log.timestamp}: ${log.details}`);
    });
    
    // 7. Check after sync
    console.log('\n6️⃣ Checking after sync...');
    const updatedSheetRows = await sheetService.getAllRows();
    const updatedDbRows = await dbService.getAllRows();
    
    console.log(`📄 Updated Sheet rows: ${updatedSheetRows.length}`);
    console.log(`🗄️  Updated DB rows: ${updatedDbRows.length}`);
    
    console.log('\n✅ Debug complete!');
    
  } catch (error: any) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugSync();