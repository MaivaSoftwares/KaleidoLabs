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