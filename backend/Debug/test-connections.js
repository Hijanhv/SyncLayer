import mysql from 'mysql2/promise';
import redis from 'redis';

async function testMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'root',
      database: 'synclayer',
      connectTimeout: 10000
    });
    
    console.log('✅ MySQL connection successful');
    
    // Create tables if they don't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        version INT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_updated_by VARCHAR(50),
        UNIQUE KEY unique_email (email)
      )
    `);
    
    console.log('✅ Table created/verified');
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ MySQL error:', error.message);
    return false;
  }
}

async function testRedis() {
  return new Promise((resolve) => {
    const client = redis.createClient({
      host: '127.0.0.1',
      port: 6379
    });
    
    client.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
      resolve(false);
    });
    
    client.on('connect', () => {
      console.log('✅ Redis connection successful');
      client.quit();
      resolve(true);
    });
  });
}

async function main() {
  console.log('🔌 Testing connections...\n');
  
  const mysqlOk = await testMySQL();
  const redisOk = await testRedis();
  
  console.log('\n📊 Results:');
  console.log(`MySQL: ${mysqlOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Redis: ${redisOk ? '✅ OK' : '❌ FAILED'}`);
  
  if (mysqlOk && redisOk) {
    console.log('\n🎉 All connections working! You can now run: pnpm dev');
  } else {
    console.log('\n⚠️  Some connections failed. Check the errors above.');
  }
}

main();