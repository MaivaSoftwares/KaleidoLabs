import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        wallet_address: string;
        is_admin: boolean;
      };
    }
  }
}

export type AuthRequest = Request;

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log('Auth middleware called');
  console.log('Headers:', JSON.stringify(req.headers));
  
  const walletAddress = req.headers['x-wallet-address'];
  console.log('Wallet address from header:', walletAddress);

  if (!walletAddress || typeof walletAddress !== 'string') {
    console.log('Authentication failed: Missing or invalid wallet address header');
    return res.status(401).json({ 
      success: false,
      message: 'Authentication required',
      error: 'Missing or invalid wallet address header'
    });
  }

  try {
    console.log('Checking database for wallet:', walletAddress);
    const [rows]: any = await pool.execute(
      'SELECT id, wallet_address, is_admin FROM users WHERE wallet_address = ?',
      [walletAddress]
    );
    console.log('Database query result:', rows);

    if (!rows.length) {
      console.log('Authentication failed: User not found in database');
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required',
        error: 'User not found' 
      });
    }

    req.user = rows[0];
    console.log('Authentication successful. User:', req.user);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Authentication failed',
      error: 'Internal server error' 
    });
  }
}; 