-- Database initialization script for Kaleido Mining

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS kaleido_mining;
USE kaleido_mining;

-- Mining sessions table
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
);

-- User points table
CREATE TABLE IF NOT EXISTS user_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_address VARCHAR(42) NOT NULL,
  total_points DECIMAL(18, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_address)
);

-- Wallet links table for connecting Kalaido wallets to Launchpad wallets
CREATE TABLE IF NOT EXISTS wallet_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kalaido_wallet VARCHAR(42) NOT NULL,
  launchpad_wallet VARCHAR(42) NOT NULL,
  project_id VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_kalaido_wallet (kalaido_wallet),
  INDEX idx_launchpad_wallet (launchpad_wallet),
  INDEX idx_project_id (project_id)
);

-- Webhook registrations table for mining notifications
CREATE TABLE IF NOT EXISTS webhook_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  callback_url VARCHAR(255) NOT NULL,
  project_id VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_notified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_wallet_project (wallet_address, project_id),
  INDEX idx_wallet_active (wallet_address, is_active)
);

-- Add some indexes for performance
CREATE INDEX IF NOT EXISTS idx_mining_sessions_user ON mining_sessions(user_address, is_active);
CREATE INDEX IF NOT EXISTS idx_user_points_address ON user_points(user_address);
