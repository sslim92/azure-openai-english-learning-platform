
import sql from 'mssql';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const sqlConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE,
  options: {
    // Azure SQL은 항상 암호화된 연결을 요구하므로 true로 고정합니다.
    encrypt: true, 
    // 로컬에서 개발 시 Azure SQL에 연결하려면 인증서 신뢰 옵션이 필요할 수 있습니다.
    trustServerCertificate: process.env.NODE_ENV !== 'production' 
  }
};

let pool: sql.ConnectionPool;

async function getDbPool(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }
  try {
    // Make sure the required variables are present
    if (!sqlConfig.server || !sqlConfig.database) {
      throw new Error('Database server and database name must be provided in environment variables.');
    }
    pool = await sql.connect(sqlConfig);
    console.log('Connected to SQL DB');
    return pool;
  } catch (err) {
    console.error('Database Connection Failed! Bad Config: ', err);
    throw err;
  }
}

export { getDbPool, sql };
