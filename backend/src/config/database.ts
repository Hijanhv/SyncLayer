import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const createDatabasePool = () => {
  console.log('🔧 Creating database pool...');
  
  // Support both naming conventions
  const host = process.env.DATABASE_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(
    process.env.DATABASE_PORT || 
    process.env.MYSQLPORT || 
    process.env.MYSQL_PORT || 
    '3306'
  );
  const user = process.env.DATABASE_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root';
  const password = process.env.DATABASE_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || 'root';
  const database = process.env.DATABASE_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'synclayer';

  console.log('📊 Database config:', { host, port, user, database });

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // Added connect timeout
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
};

export const initializeDatabase = async (pool: mysql.Pool) => {
  const connection = await pool.getConnection();
  
  try {
    console.log('📝 Creating tables...');
    
    // Change from 'contacts' to 'sync_data' or vice versa
// In initializeDatabase function
await connection.query(`
  CREATE TABLE IF NOT EXISTS sync_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_updated_by ENUM('sheet', 'db') NOT NULL,
    INDEX idx_updated_at (updated_at),
    INDEX idx_version (version)
  )
`);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};