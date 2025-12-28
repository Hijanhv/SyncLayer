import { SyncRow, SyncDiff, SyncLog } from '../types/index.js';
import { SheetService } from './sheet.service.js';
import { DatabaseService } from './database.service.js';

export class SyncEngine {
  private syncLogs: SyncLog[] = [];
  private lastLogTime: number = 0;
  private minLogInterval = 30000; // Only log no-op every 30 seconds
  
  // For debugging and monitoring
  private syncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncTime: 0,
    lastError: null as string | null
  };

  constructor(
    private sheetService: SheetService,
    private dbService: DatabaseService
  ) {}

  async performSync(): Promise<SyncLog[]> {
    const logs: SyncLog[] = [];
    const now = Date.now();

    try {
      this.syncStats.totalSyncs++;
      
      console.log(`[SyncEngine] 🔄 Starting sync #${this.syncStats.totalSyncs}`);

      const [sheetRows, dbRows] = await Promise.all([
        this.sheetService.getAllRows(),
        this.dbService.getAllRows(),
      ]);

      console.log(`[SyncEngine] 📊 Data loaded - Sheet: ${sheetRows.length} rows, DB: ${dbRows.length} rows`);

      const diff = this.computeDiff(sheetRows, dbRows);

      // Log diff statistics
      console.log(`[SyncEngine] 📈 Diff found: DB←Sheet(${diff.toUpdateInDb.length}U,${diff.toAddInDb.length}A) DB→Sheet(${diff.toUpdateInSheet.length}U,${diff.toAddInSheet.length}A)`);

      // Process Sheet → DB updates
      if (diff.toUpdateInDb.length > 0) {
        console.log(`[SyncEngine] 🗄️ Updating ${diff.toUpdateInDb.length} rows in DB from Sheet...`);
        await this.dbService.updateRows(diff.toUpdateInDb);
        logs.push(this.createLog('update', 'sheet', diff.toUpdateInDb.length, 
          `Updated ${diff.toUpdateInDb.length} rows in DB from Sheet`));
      }

      // Process Sheet → DB inserts
      if (diff.toAddInDb.length > 0) {
        console.log(`[SyncEngine] ➕ Inserting ${diff.toAddInDb.length} new rows in DB from Sheet...`);
        await this.dbService.addRows(diff.toAddInDb);
        logs.push(this.createLog('insert', 'sheet', diff.toAddInDb.length, 
          `Inserted ${diff.toAddInDb.length} new rows in DB from Sheet`));
      }

      // Process DB → Sheet updates
      if (diff.toUpdateInSheet.length > 0) {
        console.log(`[SyncEngine] 📊 Updating ${diff.toUpdateInSheet.length} rows in Sheet from DB...`);
        await this.sheetService.updateRows(diff.toUpdateInSheet);
        logs.push(this.createLog('update', 'db', diff.toUpdateInSheet.length, 
          `Updated ${diff.toUpdateInSheet.length} rows in Sheet from DB`));
      }

      // Process DB → Sheet inserts
      if (diff.toAddInSheet.length > 0) {
        console.log(`[SyncEngine] 🆕 Inserting ${diff.toAddInSheet.length} new rows in Sheet from DB...`);
        await this.sheetService.addRows(diff.toAddInSheet);
        logs.push(this.createLog('insert', 'db', diff.toAddInSheet.length, 
          `Inserted ${diff.toAddInSheet.length} new rows in Sheet from DB`));
      }

      // Only log no-op if it's been a while since last log
      if (logs.length === 0 && (now - this.lastLogTime > this.minLogInterval)) {
        logs.push(this.createLog('no-op', 'system', 0, 'No changes detected'));
        this.lastLogTime = now;
      }

      // Add logs to history
      if (logs.length > 0) {
        this.syncLogs.push(...logs);
        
        // Keep log history manageable
        if (this.syncLogs.length > 100) {
          this.syncLogs = this.syncLogs.slice(-100);
        }
        
        this.lastLogTime = now;
      }

      this.syncStats.successfulSyncs++;
      this.syncStats.lastSyncTime = now;
      this.syncStats.lastError = null;
      
      console.log(`[SyncEngine] ✅ Sync completed successfully with ${logs.length} operations`);

    } catch (error) {
      this.syncStats.failedSyncs++;
      this.syncStats.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      const errorLog = this.createLog('error', 'system', 0, 
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      logs.push(errorLog);
      this.syncLogs.push(errorLog);
      
      console.error(`[SyncEngine] ❌ Sync failed:`, error);
      throw error;
    }

    return logs;
  }

  private computeDiff(sheetRows: SyncRow[], dbRows: SyncRow[]): SyncDiff {
    const sheetMap = new Map(sheetRows.map((row) => [row.id, row]));
    const dbMap = new Map(dbRows.map((row) => [row.id, row]));

    const toAddInDb: SyncRow[] = [];
    const toUpdateInDb: SyncRow[] = [];
    const toAddInSheet: SyncRow[] = [];
    const toUpdateInSheet: SyncRow[] = [];

    // Process Sheet → DB
    for (const sheetRow of sheetRows) {
      const dbRow = dbMap.get(sheetRow.id);

      if (!dbRow) {
        // New row in sheet that doesn't exist in DB
        console.log(`[SyncEngine] ➕ New sheet row detected: ${sheetRow.id} - "${sheetRow.name}"`);
        toAddInDb.push({
          ...sheetRow,
          last_updated_by: 'sheet',
        });
      } else {
        const winner = this.resolveConflict(sheetRow, dbRow);
        
        if (winner === 'sheet' && sheetRow.last_updated_by !== 'db') {
          // Sheet wins and wasn't last updated by DB
          console.log(`[SyncEngine] 🔄 Sheet wins for row ${sheetRow.id}: "${sheetRow.name}" > "${dbRow.name}"`);
          toUpdateInDb.push({
            ...sheetRow,
            version: sheetRow.version + 1,
            updated_at: new Date().toISOString(),
            last_updated_by: 'sheet',
          });
        } else if (winner === 'none') {
          // No conflict or loop prevention
          console.log(`[SyncEngine] ⏭️ Skipping row ${sheetRow.id} - no changes needed`);
        }
      }
    }

    // Process DB → Sheet
    for (const dbRow of dbRows) {
      const sheetRow = sheetMap.get(dbRow.id);

      if (!sheetRow) {
        // New row in DB that doesn't exist in sheet
        console.log(`[SyncEngine] 🆕 New DB row detected: ${dbRow.id} - "${dbRow.name}"`);
        toAddInSheet.push({
          ...dbRow,
          last_updated_by: 'db',
        });
      } else {
        const winner = this.resolveConflict(sheetRow, dbRow);
        
        if (winner === 'db' && dbRow.last_updated_by !== 'sheet') {
          // DB wins and wasn't last updated by Sheet
          console.log(`[SyncEngine] 🔄 DB wins for row ${dbRow.id}: "${dbRow.name}" > "${sheetRow.name}"`);
          toUpdateInSheet.push({
            ...dbRow,
            version: dbRow.version + 1,
            updated_at: new Date().toISOString(),
            last_updated_by: 'db',
          });
        }
      }
    }

    return { toAddInDb, toUpdateInDb, toAddInSheet, toUpdateInSheet };
  }

  private resolveConflict(sheetRow: SyncRow, dbRow: SyncRow): 'sheet' | 'db' | 'none' {
    // First check if rows are actually equal
    if (this.rowsAreEqual(sheetRow, dbRow)) {
      return 'none';
    }

    // === DATA QUALITY ENFORCEMENT (IMPROVED) ===
    
    // Check if either side has poor quality data
    const dbDataQuality = this.getDataQuality(dbRow);
    const sheetDataQuality = this.getDataQuality(sheetRow);
    
    // Rule 1: If DB has bad data but sheet has good data → Sheet wins
    if (dbDataQuality === 'bad' && sheetDataQuality === 'good') {
      console.log(`[SyncEngine] 🛠️ Data repair: Sheet→DB (row ${sheetRow.id}) - DB has incomplete data`);
      return 'sheet';
    }
    
    // Rule 2: If Sheet has bad data but DB has good data → DB wins
    if (sheetDataQuality === 'bad' && dbDataQuality === 'good') {
      console.log(`[SyncEngine] 🛠️ Data repair: DB→Sheet (row ${dbRow.id}) - Sheet has incomplete data`);
      return 'db';
    }
    
    // Rule 3: If both have bad data, prefer the one with more complete data
    if (dbDataQuality === 'bad' && sheetDataQuality === 'bad') {
      const dbCompleteness = this.getDataCompleteness(dbRow);
      const sheetCompleteness = this.getDataCompleteness(sheetRow);
      
      if (sheetCompleteness > dbCompleteness) return 'sheet';
      if (dbCompleteness > sheetCompleteness) return 'db';
      // If equal completeness, continue to normal conflict resolution
    }

    // === LOOP PREVENTION ===
    if (sheetRow.last_updated_by === 'db') {
      console.log(`[SyncEngine] ⏭️ Loop prevention: Sheet row ${sheetRow.id} was last updated by DB`);
      return 'none';
    }

    if (dbRow.last_updated_by === 'sheet') {
      console.log(`[SyncEngine] ⏭️ Loop prevention: DB row ${dbRow.id} was last updated by Sheet`);
      return 'none';
    }

    // === TIMESTAMP/VERSION RESOLUTION ===
    const sheetTime = new Date(sheetRow.updated_at).getTime();
    const dbTime = new Date(dbRow.updated_at).getTime();
    const timeDiff = Math.abs(sheetTime - dbTime);

    // If edits were within 5 seconds of each other, treat as "simultaneous"
    if (timeDiff < 5000) {
      // Use version numbers as tie-breaker
      if (sheetRow.version > dbRow.version) {
        console.log(`[SyncEngine] ⚖️ Version tie-breaker: Sheet wins (v${sheetRow.version} > v${dbRow.version})`);
        return 'sheet';
      } else if (dbRow.version > sheetRow.version) {
        console.log(`[SyncEngine] ⚖️ Version tie-breaker: DB wins (v${dbRow.version} > v${sheetRow.version})`);
        return 'db';
      }
      // If versions are also equal, use timestamp (even though close)
    }

    // Final fallback: most recent timestamp wins
    if (sheetTime > dbTime) {
      console.log(`[SyncEngine] ⏰ Timestamp: Sheet wins (${new Date(sheetTime).toISOString()} > ${new Date(dbTime).toISOString()})`);
      return 'sheet';
    } else {
      console.log(`[SyncEngine] ⏰ Timestamp: DB wins (${new Date(dbTime).toISOString()} > ${new Date(sheetTime).toISOString()})`);
      return 'db';
    }
  }

  // Helper: Assess data quality
  private getDataQuality(row: SyncRow): 'good' | 'bad' {
    // Critical fields that should not be empty
    const hasName = row.name && row.name.trim() !== '';
    const hasEmail = row.email && row.email.trim() !== '';
    const hasStatus = row.status && row.status.trim() !== '';
    
    // Consider it "good" if it has name AND email (status is less critical)
    return (hasName && hasEmail) ? 'good' : 'bad';
  }

  // Helper: Calculate data completeness score (0-100)
  private getDataCompleteness(row: SyncRow): number {
    let score = 0;
    const maxScore = 100;
    const fieldWeight = maxScore / 3; // 3 fields: name, email, status
    
    if (row.name && row.name.trim() !== '') score += fieldWeight;
    if (row.email && row.email.trim() !== '') score += fieldWeight;
    if (row.status && row.status.trim() !== '') score += fieldWeight;
    
    return Math.round(score);
  }

  private rowsAreEqual(row1: SyncRow, row2: SyncRow): boolean {
    // Normalize whitespace for comparison
    const normalize = (str: string) => str ? str.trim() : '';
    
    return (
      normalize(row1.name) === normalize(row2.name) &&
      normalize(row1.email) === normalize(row2.email) &&
      normalize(row1.status) === normalize(row2.status) &&
      row1.version === row2.version
    );
  }

  private createLog(action: string, source: 'sheet' | 'db' | 'system', rowsAffected: number, details: string): SyncLog {
    return {
      timestamp: new Date().toISOString(),
      action,
      source,
      rowsAffected,
      details,
    };
  }

  getSyncLogs(): SyncLog[] {
    return [...this.syncLogs];
  }

  getSyncStats() {
    return {
      ...this.syncStats,
      successRate: this.syncStats.totalSyncs > 0 
        ? Math.round((this.syncStats.successfulSyncs / this.syncStats.totalSyncs) * 100) 
        : 0,
      lastSyncAgo: this.syncStats.lastSyncTime > 0 
        ? Math.round((Date.now() - this.syncStats.lastSyncTime) / 1000) 
        : null
    };
  }

  clearLogs() {
    this.syncLogs = [];
    console.log('[SyncEngine] 📭 Sync logs cleared');
  }
}