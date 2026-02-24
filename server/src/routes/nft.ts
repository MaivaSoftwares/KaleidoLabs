import { Router } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';
import metadataService from '../services/metadata';
import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

interface NFTMintRow extends RowDataPacket {
  id: number;
  user_id: number;
  token_id: string;
  chain_id: number;
  transaction_hash: string;
  contract_address: string;
  metadata_uri: string;
  created_at: Date;
}

const router = Router();

// Record a new NFT mint
router.post('/mint', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { token_id, chain_id, transaction_hash, contract_address, metadata_uri } = req.body;
    
    if (!req.user?.id || !token_id || !chain_id || !transaction_hash || !contract_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Insert the mint record
    const [result]: any = await pool.execute(
      'INSERT INTO nft_mints (user_id, token_id, chain_id, transaction_hash, contract_address, metadata_uri) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, token_id, chain_id, transaction_hash, contract_address, metadata_uri || null]
    );
    
    // Update the user's mint count
    await pool.execute(
      'UPDATE users SET mints_count = mints_count + 1 WHERE id = ?',
      [req.user.id]
    );
    
    res.status(201).json({
      success: true,
      mint_id: result.insertId,
      message: 'NFT mint recorded successfully'
    });
  } catch (error) {
    console.error('Error recording NFT mint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all NFTs minted by the authenticated user


// Get all NFTs owned by the authenticated user
router.get('/mints', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.id || !req.user.wallet_address) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get all NFTs minted by the user
    const [mintedRows] = await pool.execute<NFTMintRow[]>(
      'SELECT * FROM nft_mints ORDER BY created_at DESC'
    );

    // Get current ownership status for each NFT
    const currentOwnerPromises = mintedRows.map(async (nft: NFTMintRow) => {
      try {
        // Always check blockchain for current ownership
        const provider = new ethers.JsonRpcProvider(process.env.ABSTRACT_RPC_URL);
        const contract = new ethers.Contract(
          nft.contract_address,
          ['function ownerOf(uint256) view returns (address)'],
          provider
        );
        
        const currentOwner = await contract.ownerOf(nft.token_id);
        
        // Get the wallet address from headers or user object
        const walletAddress = req.headers['x-wallet-address'] as string || req.user?.wallet_address;
        
        // Return the NFT with ownership status
        return {
          ...nft,
          isOwned: walletAddress?.toLowerCase() === currentOwner.toLowerCase()
        };
      } catch (error) {
        console.error(`Error checking ownership for NFT ${nft.token_id}:`, error);
        return { ...nft, isOwned: false };
      }
    });

    const nfts = await Promise.all(currentOwnerPromises);
    
    res.json(nfts);
  } catch (error) {
    console.error('Error fetching user NFT mints:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific NFT by token ID
router.get('/mint/:tokenId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get the mint record
    const [mintRows] = await pool.execute<NFTMintRow[]>(
      'SELECT * FROM nft_mints WHERE token_id = ?',
      [tokenId]
    );

    if (!mintRows.length) {
      return res.status(404).json({ error: 'NFT not found' });
    }

    const mint = mintRows[0];

    // Check current ownership from database first
    const [dbOwnerRows] = await pool.execute<RowDataPacket[]>(
      'SELECT current_owner_address FROM nft_mints WHERE token_id = ?',
      [tokenId]
    );
    
    let currentOwner = dbOwnerRows[0]?.current_owner_address;
    
    // If not in database, check blockchain
    if (!currentOwner) {
      const provider = new ethers.JsonRpcProvider(process.env.ABSTRACT_RPC_URL);
      const contract = new ethers.Contract(
        mint.contract_address,
        ['function ownerOf(uint256) view returns (address)'],
        provider
      );
      
      currentOwner = await contract.ownerOf(tokenId);
      
      // Update database with blockchain ownership
      await pool.execute(
        'UPDATE nft_mints SET current_owner_address = ? WHERE token_id = ?',
        [currentOwner, tokenId]
      );
    }
    
    const isOwned = req.user?.wallet_address?.toLowerCase() === currentOwner.toLowerCase() || false;

    res.json({
      ...mint,
      isOwned
    });
  } catch (error) {
    console.error('Error fetching NFT mint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get total NFT stats
router.get('/stats', async (req, res) => {
  try {
    const [totalMints] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM nft_mints'
    );
    
    const [uniqueOwners] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(DISTINCT user_id) as total FROM nft_mints'
    );
    
    res.json({
      total_mints: totalMints[0].total,
      unique_owners: uniqueOwners[0].total
    });
  } catch (error) {
    console.error('Error fetching NFT stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public API: Get transaction hash and mint count for a wallet address
router.get('/public/wallet/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid wallet address format. Must be a valid Ethereum address.'
      });
    }
    
    // First get the user ID for this wallet address
    const [userRows] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE wallet_address = ?',
      [address]
    );
    
    // If no user found, return empty results
    if (!userRows.length) {
      return res.json({
        success: true,
        address,
        mint_count: 0,
        transactions: []
      });
    }
    
    const userId = userRows[0].id;
    
    // Get all NFT mints for this user
    const [mintRows] = await pool.execute<NFTMintRow[]>(
      `SELECT token_id, transaction_hash, contract_address, created_at 
       FROM nft_mints 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    // Get the mint count from the users table
    const [mintCountRows] = await pool.execute<RowDataPacket[]>(
      'SELECT mints_count FROM users WHERE id = ?',
      [userId]
    );
    
    const mintCount = mintCountRows.length > 0 ? mintCountRows[0].mints_count : 0;
    
    // Format the response
    res.json({
      success: true,
      address,
      mint_count: mintCount,
      transactions: mintRows.map(row => ({
        token_id: row.token_id,
        transaction_hash: row.transaction_hash,
        contract_address: row.contract_address,
        timestamp: row.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching wallet NFT data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: 'Failed to retrieve NFT data for this wallet address'
    });
  }
});

// Metadata endpoints

// Generate and serve metadata for a token
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    // Check if metadata already exists
    const metadataDir = path.join(__dirname, '../../public/metadata');
    const metadataPath = path.join(metadataDir, `${tokenId}.json`);
    
    if (fs.existsSync(metadataPath)) {
      // Serve existing metadata
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return res.json(metadata);
    }
    
    // Get the owner address for this token
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT u.wallet_address FROM nft_mints n JOIN users u ON n.user_id = u.id WHERE n.token_id = ?',
      [tokenId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'NFT not found' });
    }
    
    const ownerAddress = rows[0].wallet_address;
    
    // Generate new metadata
    const metadata = await metadataService.generateMetadata(tokenId, ownerAddress);
    res.json(metadata);
  } catch (error) {
    console.error('Error generating metadata:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve NFT image
router.get('/image/:tokenId', async (req, res) => {
  try {
    // Serve the existing GIF from the public directory
    const nftGifPath = path.join(__dirname, '../../public/nft.gif');
    
    if (fs.existsSync(nftGifPath)) {
      return res.sendFile(nftGifPath);
    } else {
      console.warn('NFT GIF not found at:', nftGifPath);
      return res.status(404).json({ error: 'NFT image not found' });
    }
  } catch (error) {
    console.error('Error serving NFT image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public API: Verify NFT ownership from the blockchain
router.get('/public/verify/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { chainId } = req.query;
    
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid wallet address format. Must be a valid Ethereum address.'
      });
    }
    
    // Get contract address and RPC URL from environment variables
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    
    if (!contractAddress || !rpcUrl) {
      return res.status(500).json({ 
        success: false, 
        error: 'Missing contract configuration'
      });
    }
    
    try {
      // Connect to the blockchain
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, [
        {
          "inputs": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            }
          ],
          "name": "balanceOf",
          "outputs": [
            {
              "internalType": "uint256",
              "name": "",
              "type": "uint256"
            }
          ],
          "stateMutability": "view",
          "type": "function"
        }
      ], provider);
      
      // Call balanceOf to get the number of NFTs owned by the wallet
      const balance = await contract.balanceOf(address);
      const nftCount = parseInt(balance.toString());
      
      // Get user info from database if available
      const [userRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, mints_count FROM users WHERE wallet_address = ?',
        [address]
      );
      
      const dbMintCount = userRows.length > 0 ? userRows[0].mints_count : 0;
      
      res.json({
        success: true,
        address,
        blockchain_nft_count: nftCount,
        database_mint_count: dbMintCount,
        contract_address: contractAddress,
        chain_id: chainId || 'default'
      });
    } catch (error) {
      console.error('Blockchain verification error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to verify NFT ownership on blockchain',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: 'Failed to verify NFT ownership'
    });
  }
});

export default router;
