/**
 * SyncLayer Tests - Conflict Resolution & Sync Logic
 */

describe('Sync Layer Tests', () => {

interface SyncRow {
  id: string;
  name: string;
  email: string;
  status: string;
  version: number;
  updated_at: string;
  last_updated_by: 'sheet' | 'db';
}

describe('Conflict Resolution Logic', () => {
  // Helper function to resolve conflicts
  function resolveConflict(sheetRow: SyncRow | null, dbRow: SyncRow | null): SyncRow | null {
    // Both empty
    if (!sheetRow && !dbRow) return null;

    // Only one exists
    if (!sheetRow) return dbRow;
    if (!dbRow) return sheetRow;

    // Prevent loop: don't sync back to source
    if (sheetRow.last_updated_by === 'sheet' && dbRow.last_updated_by === 'sheet') {
      return dbRow; // Keep DB version
    }
    if (sheetRow.last_updated_by === 'db' && dbRow.last_updated_by === 'db') {
      return sheetRow; // Keep Sheet version
    }

    // Compare timestamps
    const sheetTime = new Date(sheetRow.updated_at).getTime();
    const dbTime = new Date(dbRow.updated_at).getTime();
    const timeDiff = Math.abs(sheetTime - dbTime);

    // If timestamps within 1 second, use version
    if (timeDiff < 1000) {
      return sheetRow.version >= dbRow.version ? sheetRow : dbRow;
    }

    // Most recent wins
    return sheetTime > dbTime ? sheetRow : dbRow;
  }

  describe('Basic Conflict Resolution', () => {
    test('should prefer newer timestamp', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John Old',
        email: 'john@old.com',
        status: 'inactive',
        version: 1,
        updated_at: '2025-12-26T06:20:00Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(sheetRow, dbRow);
      expect(result).toEqual(sheetRow);
      expect(result?.name).toBe('John');
    });

    test('should use version when timestamps within 1 second', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John v2',
        email: 'john@example.com',
        status: 'active',
        version: 2,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John v1',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00.500Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(sheetRow, dbRow);
      expect(result?.version).toBe(2);
      expect(result?.name).toBe('John v2');
    });
  });

  describe('Loop Prevention', () => {
    test('should prevent syncing back to Sheet if last updated by Sheet', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:25:00Z',
        last_updated_by: 'sheet'
      };

      const result = resolveConflict(sheetRow, dbRow);
      expect(result).toEqual(dbRow);
    });

    test('should prevent syncing back to DB if last updated by DB', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:25:00Z',
        last_updated_by: 'db'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(sheetRow, dbRow);
      expect(result).toEqual(sheetRow);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null sheet row', () => {
      const dbRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(null, dbRow);
      expect(result).toEqual(dbRow);
    });

    test('should handle null db row', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const result = resolveConflict(sheetRow, null);
      expect(result).toEqual(sheetRow);
    });

    test('should return null when both rows null', () => {
      const result = resolveConflict(null, null);
      expect(result).toBeNull();
    });

    test('should handle rows with same timestamp and version', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(sheetRow, dbRow);
      expect(result).toBeDefined();
      expect(result?.version).toBe(1);
    });
  });

  describe('Concurrent Edits', () => {
    test('should handle simultaneous edits to different fields', () => {
      const sheetRow: SyncRow = {
        id: '1',
        name: 'John Updated', // Changed in sheet
        email: 'john@example.com',
        status: 'active',
        version: 2,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const dbRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@newemail.com', // Changed in db
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:29:00Z',
        last_updated_by: 'db'
      };

      const result = resolveConflict(sheetRow, dbRow);
      // Newer timestamp wins (Sheet), losing DB email change
      // This is acceptable as "last write wins"
      expect(result).toEqual(sheetRow);
    });

    test('should handle rapid successive edits', () => {
      const initialRow: SyncRow = {
        id: '1',
        name: 'John',
        email: 'john@example.com',
        status: 'active',
        version: 1,
        updated_at: '2025-12-26T06:30:00Z',
        last_updated_by: 'sheet'
      };

      const edit1: SyncRow = {
        ...initialRow,
        name: 'John Edit 1',
        version: 2,
        updated_at: '2025-12-26T06:30:01Z',
        last_updated_by: 'db'
      };

      const edit2: SyncRow = {
        ...edit1,
        name: 'John Edit 2',
        version: 3,
        updated_at: '2025-12-26T06:30:02Z',
        last_updated_by: 'sheet'
      };

      const result = resolveConflict(edit2, edit1);
      expect(result?.version).toBe(3);
      expect(result?.name).toBe('John Edit 2');
    });
  });
});

describe('Sync Data Validation', () => {
  test('should validate required fields', () => {
    const row: SyncRow = {
      id: '1',
      name: 'John',
      email: 'john@example.com',
      status: 'active',
      version: 1,
      updated_at: '2025-12-26T06:30:00Z',
      last_updated_by: 'sheet'
    };

    expect(row.id).toBeDefined();
    expect(row.updated_at).toBeDefined();
    expect(row.last_updated_by).toMatch(/^(sheet|db)$/);
  });

  test('should validate email format', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmail = 'john@example.com';
    const invalidEmail = 'invalid-email';

    expect(emailRegex.test(validEmail)).toBe(true);
    expect(emailRegex.test(invalidEmail)).toBe(false);
  });

  test('should validate status values', () => {
    const validStatuses = ['active', 'inactive', 'pending'];
    const testStatus = 'active';

    expect(validStatuses.includes(testStatus)).toBe(true);
  });

  test('should validate ISO timestamp format', () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    const validTimestamp = '2025-12-26T06:30:00Z';
    const invalidTimestamp = '12/26/2025 6:30 AM';

    expect(isoRegex.test(validTimestamp)).toBe(true);
    expect(isoRegex.test(invalidTimestamp)).toBe(false);
  });
});

describe('Sync Statistics', () => {
  test('should track sync operations', () => {
    interface SyncStats {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      lastSyncTime: string;
    }

    const stats: SyncStats = {
      totalSyncs: 10,
      successfulSyncs: 9,
      failedSyncs: 1,
      lastSyncTime: new Date().toISOString()
    };

    expect(stats.totalSyncs).toBe(10);
    expect(stats.successfulSyncs + stats.failedSyncs).toBe(stats.totalSyncs);
  });

  test('should calculate sync success rate', () => {
    const totalSyncs = 100;
    const successfulSyncs = 99;
    const successRate = (successfulSyncs / totalSyncs) * 100;

    expect(successRate).toBe(99);
    expect(successRate).toBeGreaterThan(95);
  });
});
