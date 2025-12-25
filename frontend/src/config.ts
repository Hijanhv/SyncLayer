export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const SYNC_INTERVAL = 5000;

export const ENDPOINTS = {
  HEALTH: '/health',
  TRIGGER_SYNC: '/api/sync/trigger',
  SYNC_LOGS: '/api/sync/logs',
  SYNC_STATS: '/api/sync/stats',
  SHEET_DATA: '/api/data/sheet',
  DB_DATA: '/api/data/db',
} as const;
