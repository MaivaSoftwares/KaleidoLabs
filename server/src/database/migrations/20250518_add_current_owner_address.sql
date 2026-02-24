-- Add current_owner_address column to track NFT ownership
ALTER TABLE nft_mints ADD COLUMN current_owner_address VARCHAR(42) DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX idx_nft_mints_owner ON nft_mints(current_owner_address);
