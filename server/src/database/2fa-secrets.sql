-- Create table for 2FA secrets
CREATE TABLE IF NOT EXISTS user_2fa_secrets (
  wallet_address VARCHAR(255) PRIMARY KEY,
  secret VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX idx_wallet_address ON user_2fa_secrets(wallet_address);
