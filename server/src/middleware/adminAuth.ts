import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { pool } from '../config/database';

export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log('Admin middleware called');
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Current user:', req.user);
  console.log('Admin middleware called');
  console.log('Headers:', JSON.stringify(req.headers));
  
  // Check for admin token first (direct admin auth)
  const adminToken = req.headers['x-admin-token'];
  
  if (adminToken && typeof adminToken === 'string') {
    console.log('Admin token found, validating...');
    try {
      // Decode the admin token
      const decodedToken = Buffer.from(adminToken, 'base64').toString('utf-8');
      const [prefix, walletAddress, timestamp] = decodedToken.split(':');
      
      if (prefix !== 'admin') {
        console.log('Invalid admin token prefix');
        console.log('Token prefix:', prefix);
        // Continue to standard auth check
      } else {
        // Check if token is not expired (24 hour validity)
        const tokenTime = parseInt(timestamp);
        const currentTime = Date.now();
        const tokenAge = currentTime - tokenTime;
        
        if (isNaN(tokenTime) || tokenAge > 24 * 60 * 60 * 1000) {
          console.log('Admin token expired');
          console.log('Token time:', tokenTime);
          console.log('Token age:', tokenAge);
          // Continue to standard auth check
        } else {
          console.log('Valid admin token for wallet:', walletAddress);
          
          // Set user object in request first
          req.user = {
            id: 0, // Will be updated by database query
            wallet_address: walletAddress,
            is_admin: true
          };
          
          // Get user from database to verify admin status
          const [rows]: any = await pool.execute(
            'SELECT id, wallet_address, is_admin FROM users WHERE wallet_address = ?',
            [walletAddress]
          );
          
          if (rows.length > 0 && rows[0].is_admin) {
            console.log('Found admin user:', rows[0]);
            // Update user object with database values
            req.user = rows[0];
            console.log('Admin authenticated via token');
            return next();
          }
        }
      }
    } catch (error) {
      console.error('Error validating admin token:', error);
      // Continue to standard auth check
    }
  }
  
  // Standard auth check if admin token validation fails
  console.log('Falling back to standard auth check');
  console.log('User from request:', req.user);
  
  // First check if the user is authenticated
  if (!req.user) {
    console.log('Admin check failed: No authenticated user');
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required' 
    });
  }
  
  // Then check if the user is an admin
  console.log('Checking if user is admin. is_admin value:', req.user.is_admin);
  if (!req.user.is_admin) {
    console.log('Admin check failed: User is not an admin');
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
  
  // If we get here, the user is an authenticated admin
  console.log('Admin check passed: User is an authenticated admin');
  next();
};
