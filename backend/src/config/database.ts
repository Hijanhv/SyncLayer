import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const createDatabasePool = () => {
  return mysql.createPool({
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQLPORT || process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'synclayer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
};

export const initializeDatabase = async (pool: mysql.Pool) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sync_data (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        last_updated_by ENUM('sheet', 'db') NOT NULL,
        INDEX idx_updated_at (updated_at),
        INDEX idx_version (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✅ Database initialized');
  } finally {
    connection.release();
  }
};
