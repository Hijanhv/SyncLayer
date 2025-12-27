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

// config.ts - UPDATED VERSION
console.log('🔧 Loading config...');
console.log('Environment VITE_API_URL:', import.meta.env.VITE_API_URL);

// Use the environment variable directly
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('API_BASE_URL:', API_BASE_URL);

export const SYNC_INTERVAL = 5000;

export const ENDPOINTS = {
  HEALTH: '/health',
  TRIGGER_SYNC: '/api/sync/trigger',
  SYNC_LOGS: '/api/sync/logs',
  SYNC_STATS: '/api/sync/stats',
  SHEET_DATA: '/api/data/sheet',
  DB_DATA: '/api/data/db',
} as const;