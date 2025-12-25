export interface SyncRow {
  id: string;
  name: string;
  email: string;
  status: string;
  version: number;
  updated_at: string;
  last_updated_by: 'sheet' | 'db';
}

export interface SheetRow {
  id: string;
  name: string;
  email: string;
  status: string;
  version: string;
  updated_at: string;
  last_updated_by: string;
}

export interface SyncDiff {
  toAddInDb: SyncRow[];
  toUpdateInDb: SyncRow[];
  toAddInSheet: SyncRow[];
  toUpdateInSheet: SyncRow[];
}

export interface SyncLog {
  timestamp: string;
  action: string;
  source: 'sheet' | 'db';
  rowsAffected: number;
  details: string;
}

export type SyncSource = 'sheet' | 'db';
