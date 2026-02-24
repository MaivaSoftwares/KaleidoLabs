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
