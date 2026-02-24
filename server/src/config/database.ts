import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'kaleido_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}); 