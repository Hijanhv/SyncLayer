
import { google } from 'googleapis';
import { readFileSync } from 'fs';

async function testSheets() {
  try {
    console.log('🔧 Testing Google Sheets connection...');
    
    // Read the service account key
    const keyFile = JSON.parse(readFileSync('./service-account-key.json', 'utf8'));
    console.log('✅ Service account key loaded, type:', keyFile.type);
    console.log('📧 Client email:', keyFile.client_email);
    
    // Authenticate
    const auth = new google.auth.GoogleAuth({
      credentials: keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const authClient = await auth.getClient();
    console.log('✅ Authentication successful');
    
    // Initialize sheets
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('✅ Sheets API initialized');
    
    // Test with your sheet ID
    const sheetId = '1ybpzJq-LX-AYxkldoYFi2CVZbd7K7Przpj9j_dJOa0M';
    
    // Get spreadsheet info
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    
    console.log('📊 Spreadsheet info:');
    console.log('Title:', response.data.properties.title);
    console.log('Sheets:', response.data.sheets.map(s => s.properties.title));
    
    // Test reading data
    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:Z1000',
    });
    
    console.log('✅ Data read successful');
    console.log('Rows found:', data.data.values ? data.data.values.length : 0);
    
    if (data.data.values && data.data.values.length > 0) {
      console.log('First row:', data.data.values[0]);
    }
    
  } catch (error) {
    console.error('❌ Sheets test failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
  }
}

testSheets();