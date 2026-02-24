import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './config/database';
import authRoutes from './routes/auth';
import nftRoutes from './routes/nft';
import miningRoutes from './routes/mining';
import miningPublicRoutes from './routes/mining-public';
import adminRoutes from './routes/admin';
import nftImageRoutes from './routes/nft-image';
import nftAnimationRoutes from './routes/nft-animation';
import twoFactorRoutes from './routes/twoFactor';
import path from 'path';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database tables
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        email VARCHAR(255),
        avatar_url TEXT,
        is_admin BOOLEAN DEFAULT FALSE,
        mints_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wallet (wallet_address),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create NFT mints table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS nft_mints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_id VARCHAR(255) NOT NULL,
        chain_id INT NOT NULL,
        transaction_hash VARCHAR(255) NOT NULL,
        contract_address VARCHAR(42) NOT NULL,
        metadata_uri TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        INDEX idx_user (user_id),
        INDEX idx_token (token_id),
        INDEX idx_chain (chain_id),
        UNIQUE KEY unique_mint (chain_id, token_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create mining sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS mining_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_address VARCHAR(42) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NULL,
        cpu_count INT NOT NULL,
        cores_per_cpu INT NOT NULL,
        ram_per_cpu INT NOT NULL,
        mining_rate DECIMAL(18, 8) NOT NULL,
        total_points DECIMAL(18, 8) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_address (user_address),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create user points table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_points (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_address VARCHAR(42) NOT NULL,
        total_points DECIMAL(18, 8) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user (user_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Create webhook registrations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS webhook_registrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        wallet_address VARCHAR(42) NOT NULL,
        callback_url VARCHAR(255) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_notified_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX idx_wallet_address (wallet_address),
        INDEX idx_project_id (project_id),
        UNIQUE KEY unique_project_wallet (project_id, wallet_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    connection.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/nft', nftRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api', twoFactorRoutes);
app.use('/api/mining-public', miningPublicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', nftImageRoutes);
app.use('/api', nftAnimationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
const PORT = process.env.PORT || 3001;

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 