
import sql from 'mssql';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const dbConfig = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true, // for Azure SQL
    trustServerCertificate: true,
  },
};

let pool: sql.ConnectionPool;

async function getDbPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  try {
    if (!dbConfig.server || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
      throw new Error('Database configuration (server, database, user, password) must be provided in environment variables.');
    }
    
    pool = await sql.connect(dbConfig);
    
    console.log('Connected to SQL DB.');
    return pool;
  } catch (err) {
    console.error('Database Connection Failed! Check your environment variables: ', err);
    pool = undefined as any; 
    throw err;
  }
}

export { getDbPool, sql };
