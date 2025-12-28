import { sheets_v4 } from 'googleapis';
import { SyncRow, SheetRow } from '../types/index.js';
import { SHEET_ID, SHEET_RANGE, SHEET_NAME } from '../config/sheets.js';

export class SheetService {
  constructor(private sheets: sheets_v4.Sheets) {}

  async getAllRows(): Promise<SyncRow[]> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: SHEET_RANGE,
      });

      const rows = response.data.values || [];
      
      if (rows.length <= 1) {
        return [];
      }

      return rows.slice(1).map((row) => this.parseSheetRow(row));
    } catch (error) {
      console.error('Error fetching sheet rows:', error);
      throw error;
    }
  }

  private parseSheetRow(row: any[]): SyncRow {
    const parsed = {
      id: String(row[0] || '').trim(),
      name: String(row[1] || '').trim(),
      email: String(row[2] || '').trim(),
      status: String(row[3] || 'active').trim(),
      version: parseInt(row[4] || '1'),
      updated_at: row[5] || new Date().toISOString(),
      last_updated_by: (row[6] === 'db' ? 'db' : 'sheet') as 'sheet' | 'db',
    };

    console.log(`[SheetService] Parsed row: ${parsed.id} | ${parsed.name} | ${parsed.email}`);
    return parsed;
  }

  async updateRows(rows: SyncRow[]): Promise<void> {
    if (rows.length === 0) return;

    const allRows = await this.getAllRowsWithIndex();
    const updates: any[] = [];

    for (const row of rows) {
      const existingIndex = allRows.findIndex((r) => r.data.id === row.id);
      
      if (existingIndex !== -1) {
        const rowIndex = existingIndex + 2;
        updates.push({
          range: `${SHEET_NAME}!A${rowIndex}:G${rowIndex}`,
          values: [this.rowToSheetFormat(row)],
        });
      }
    }

    if (updates.length > 0) {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      });
    }
  }

  async addRows(rows: SyncRow[]): Promise<void> {
    if (rows.length === 0) return;

    const values = rows.map((row) => this.rowToSheetFormat(row));

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
  }

  private async getAllRowsWithIndex(): Promise<Array<{ data: SyncRow; index: number }>> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: SHEET_RANGE,
    });

    const rows = response.data.values || [];
    
    if (rows.length <= 1) {
      return [];
    }

    return rows.slice(1).map((row, index) => ({
      data: this.parseSheetRow(row),
      index,
    }));
  }

  private rowToSheetFormat(row: SyncRow): any[] {
    return [
      row.id,
      row.name,
      row.email,
      row.status,
      row.version.toString(),
      row.updated_at,
      row.last_updated_by,
    ];
  }

  async ensureHeaders(): Promise<void> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:G1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A1:G1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'name', 'email', 'status', 'version', 'updated_at', 'last_updated_by']],
        },
      });
    }
  }
}
