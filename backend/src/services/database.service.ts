import mysql from 'mysql2/promise';
import { SyncRow } from '../types/index.js';

export class DatabaseService {
  constructor(private pool: mysql.Pool) {}

  private formatDateForMySQL(date: string): string {
    const d = new Date(date);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  async getAllRows(): Promise<SyncRow[]> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM sync_data ORDER BY id'
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      version: row.version,
      updated_at: new Date(row.updated_at).toISOString(),
      last_updated_by: row.last_updated_by,
    }));
  }

  async updateRows(rows: SyncRow[]): Promise<void> {
    if (rows.length === 0) return;

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const row of rows) {
        await connection.query(
          `UPDATE sync_data 
           SET name = ?, email = ?, status = ?, version = ?, 
               updated_at = ?, last_updated_by = ?
           WHERE id = ?`,
          [row.name, row.email, row.status, row.version, 
           this.formatDateForMySQL(row.updated_at), row.last_updated_by, row.id]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async addRows(rows: SyncRow[]): Promise<void> {
    if (rows.length === 0) return;

    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      for (const row of rows) {
        await connection.query(
          `INSERT INTO sync_data 
           (id, name, email, status, version, updated_at, last_updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.name, row.email, row.status, row.version, 
           this.formatDateForMySQL(row.updated_at), row.last_updated_by]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async createRow(data: Omit<SyncRow, 'id'>): Promise<void> {
    // Get the next available ID
    const [maxIdRow] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT COALESCE(MAX(CAST(id AS UNSIGNED)), 0) + 1 as next_id FROM sync_data'
    );
    const nextId = maxIdRow[0].next_id.toString();

    await this.pool.query(
      `INSERT INTO sync_data 
       (id, name, email, status, version, updated_at, last_updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nextId, data.name, data.email, data.status, data.version, 
       this.formatDateForMySQL(data.updated_at), data.last_updated_by]
    );
  }

  async getRowById(id: string): Promise<SyncRow | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM sync_data WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      version: row.version,
      updated_at: new Date(row.updated_at).toISOString(),
      last_updated_by: row.last_updated_by,
    };
  }
}
