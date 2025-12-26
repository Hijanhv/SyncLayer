// Try to get API URL from environment variable, window object, or use smart default
let apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl && typeof window !== 'undefined') {
  // If running on Railway, construct API URL from current domain
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // If we're on a Railway domain, assume backend is on same infrastructure
  if (hostname.includes('railway.app')) {
    // The backend URL should be set via environment, but if not, try common patterns
    apiUrl = `${protocol}//synclayer-production.up.railway.app`;
  }
}

export const API_BASE_URL = apiUrl || 'http://localhost:8080';

export const SYNC_INTERVAL = 5000;

export const ENDPOINTS = {
  HEALTH: '/health',
  TRIGGER_SYNC: '/api/sync/trigger',
  SYNC_LOGS: '/api/sync/logs',
  SYNC_STATS: '/api/sync/stats',
  SHEET_DATA: '/api/data/sheet',
  DB_DATA: '/api/data/db',
} as const;
