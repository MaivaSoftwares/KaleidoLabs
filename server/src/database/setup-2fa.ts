import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

async function setup2FA() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '2fa-secrets.sql'), 'utf8');
    await pool.query(sql);
    console.log('2FA secrets table created successfully!');
  } catch (error) {
    console.error('Error setting up 2FA table:', error);
    process.exit(1);
  }
}

setup2FA();
