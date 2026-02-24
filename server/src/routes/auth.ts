import { Router } from 'express';
import { pool } from '../config/database';
import { SiweMessage } from 'siwe';
import { AuthRequest } from '../middleware/auth';
import { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  wallet_address: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  mints_count: number;
  created_at: Date;
  last_login: Date;
}

const router = Router();

// Get nonce for wallet
router.get('/nonce/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const nonce = Math.floor(Math.random() * 1000000).toString();
    
    await pool.execute(
      'INSERT INTO users (wallet_address, nonce) VALUES (?, ?) ON DUPLICATE KEY UPDATE nonce = ?',
      [address, nonce, nonce]
    );
    
    res.json({ nonce });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify signature and login
router.post('/verify', async (req, res) => {
  try {
    const { message, signature, address, simplified } = req.body;
    
    // Handle simplified authentication flow
    if (simplified && address) {
      console.log('Using simplified authentication flow for address:', address);
      
      // Update the user's last login timestamp
      await pool.execute(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE wallet_address = ?',
        [address]
      );
      
      // If the user doesn't exist yet, create them
      const [existingUser] = await pool.execute<UserRow[]>(
        'SELECT id FROM users WHERE wallet_address = ?',
        [address]
      );
      
      if (!existingUser.length) {
        console.log('Creating new user for address:', address);
        await pool.execute(
          'INSERT INTO users (wallet_address, created_at, last_login) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [address]
        );
      }
      
      return res.json({
        success: true,
        address: address
      });
    }
    
    // Original SIWE authentication flow
    try {
      const siweMessage = new SiweMessage(message);
      const fields = await siweMessage.verify({ signature });
      
      if (!fields.success) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      await pool.execute(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE wallet_address = ?',
        [fields.data.address]
      );
      
      res.json({
        success: true,
        address: fields.data.address
      });
    } catch (siweError) {
      console.error('SIWE verification error:', siweError);
      return res.status(401).json({ error: 'Invalid SIWE signature' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, wallet_address, username, email, avatar_url, is_admin, mints_count, created_at, last_login FROM users WHERE wallet_address = ?',
      [req.user?.wallet_address]
    );
    
    res.json(rows[0] || null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Direct admin authentication endpoint
router.post('/admin-auth', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    console.log('Admin auth attempt for wallet:', walletAddress);
    
    // Check if the user exists and is an admin
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, wallet_address, is_admin FROM users WHERE wallet_address = ?',
      [walletAddress]
    );
    
    console.log('Admin auth database result:', rows);
    
    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = rows[0];
    
    if (!user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'User is not an admin'
      });
    }
    
    // Update last login time
    await pool.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE wallet_address = ?',
      [walletAddress]
    );
    
    // Set user object in request
    (req as AuthRequest).user = user;
    
    // Return success with admin token
    const adminToken = Buffer.from(`admin:${walletAddress}:${Date.now()}`).toString('base64');
    
    res.json({
      success: true,
      message: 'Admin authentication successful',
      walletAddress,
      adminToken
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Check if a wallet has previously authenticated
router.get('/check/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({
        exists: false,
        message: 'Wallet address is required'
      });
    }
    
    // Check if the user exists in the database
    const [rows] = await pool.execute<UserRow[]>(
      'SELECT id, last_login FROM users WHERE wallet_address = ?',
      [address]
    );
    
    // If the user exists and has logged in before, they've authenticated
    const exists = rows.length > 0 && rows[0].last_login !== null;
    
    res.json({
      exists,
      message: exists ? 'Wallet has previously authenticated' : 'Wallet has not authenticated before'
    });
  } catch (error) {
    console.error('Wallet check error:', error);
    res.status(500).json({
      exists: false,
      message: 'Internal server error'
    });
  }
});

export default router; 