import { SyncRow, SyncDiff, SyncLog } from '../types/index.js';
import { SheetService } from './sheet.service.js';
import { DatabaseService } from './database.service.js';

export class SyncEngine {
  private syncLogs: SyncLog[] = [];
  private minLogInterval = 30000; // Only log every 30 seconds minimum

  constructor(
    private sheetService: SheetService,
    private dbService: DatabaseService
  ) {}

  async performSync(): Promise<SyncLog[]> {
    const logs: SyncLog[] = [];

    try {
      const [sheetRows, dbRows] = await Promise.all([
        this.sheetService.getAllRows(),
        this.dbService.getAllRows(),
      ]);

      const diff = this.computeDiff(sheetRows, dbRows);

      if (diff.toUpdateInDb.length > 0) {
        await this.dbService.updateRows(diff.toUpdateInDb);
        logs.push(this.createLog('update', 'sheet', diff.toUpdateInDb.length, 
          `Updated ${diff.toUpdateInDb.length} rows in DB from Sheet`));
      }

      if (diff.toAddInDb.length > 0) {
        await this.dbService.addRows(diff.toAddInDb);
        logs.push(this.createLog('insert', 'sheet', diff.toAddInDb.length, 
          `Inserted ${diff.toAddInDb.length} new rows in DB from Sheet`));
      }

      if (diff.toUpdateInSheet.length > 0) {
        await this.sheetService.updateRows(diff.toUpdateInSheet);
        logs.push(this.createLog('update', 'db', diff.toUpdateInSheet.length, 
          `Updated ${diff.toUpdateInSheet.length} rows in Sheet from DB`));
      }

      if (diff.toAddInSheet.length > 0) {
        await this.sheetService.addRows(diff.toAddInSheet);
        logs.push(this.createLog('insert', 'db', diff.toAddInSheet.length, 
          `Inserted ${diff.toAddInSheet.length} new rows in Sheet from DB`));
      }

      if (logs.length === 0) {
        logs.push(this.createLog('no-op', 'sheet', 0, 'No changes detected'));
      }

      this.syncLogs.push(...logs);
      if (this.syncLogs.length > 100) {
        this.syncLogs = this.syncLogs.slice(-100);
      }

    } catch (error) {
      const errorLog = this.createLog('error', 'sheet', 0, 
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logs.push(errorLog);
      this.syncLogs.push(errorLog);
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

    for (const sheetRow of sheetRows) {
      const dbRow = dbMap.get(sheetRow.id);

      if (!dbRow) {
        toAddInDb.push({
          ...sheetRow,
          last_updated_by: 'sheet',
        });
      } else {
        const winner = this.resolveConflict(sheetRow, dbRow);
        
        if (winner === 'sheet' && sheetRow.last_updated_by !== 'db') {
          toUpdateInDb.push({
            ...sheetRow,
            version: sheetRow.version + 1,
            updated_at: new Date().toISOString(),
            last_updated_by: 'sheet',
          });
        }
      }
    }

    for (const dbRow of dbRows) {
      const sheetRow = sheetMap.get(dbRow.id);

      if (!sheetRow) {
        toAddInSheet.push({
          ...dbRow,
          last_updated_by: 'db',
        });
      } else {
        const winner = this.resolveConflict(sheetRow, dbRow);
        
        if (winner === 'db' && dbRow.last_updated_by !== 'sheet') {
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
    if (this.rowsAreEqual(sheetRow, dbRow)) {
      return 'none';
    }

    if (sheetRow.last_updated_by === 'db') {
      return 'none';
    }

    if (dbRow.last_updated_by === 'sheet') {
      return 'none';
    }

    const sheetTime = new Date(sheetRow.updated_at).getTime();
    const dbTime = new Date(dbRow.updated_at).getTime();

    if (Math.abs(sheetTime - dbTime) < 1000) {
      return sheetRow.version > dbRow.version ? 'sheet' : 'db';
    }

    return sheetTime > dbTime ? 'sheet' : 'db';
  }

  private rowsAreEqual(row1: SyncRow, row2: SyncRow): boolean {
    return (
      row1.name === row2.name &&
      row1.email === row2.email &&
      row1.status === row2.status &&
      row1.version === row2.version
    );
  }

  private createLog(action: string, source: 'sheet' | 'db', rowsAffected: number, details: string): SyncLog {
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
}
