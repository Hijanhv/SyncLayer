import { google } from 'googleapis';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const createSheetsClient = () => {
  let credentials;
  
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } else {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account-key.json';
    credentials = JSON.parse(readFileSync(keyPath, 'utf-8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
};

// Use GOOGLE_SHEETS_SHEET_ID to match your .env file
export const SHEET_ID = process.env.GOOGLE_SHEETS_SHEET_ID || '';
export const SHEET_NAME = 'Sheet1';
export const SHEET_RANGE = `${SHEET_NAME}!A:G`;

// Log for debugging
console.log('📊 Sheets Config:', { 
  SHEET_ID: SHEET_ID ? 'Set' : 'Not set',
  SHEET_NAME,
  SHEET_RANGE 
});
