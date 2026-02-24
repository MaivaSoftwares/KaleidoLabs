import { Request, Response, NextFunction, RequestHandler } from 'express';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { AuthRequest } from './auth';
import { pool } from '../config/database';
import { RowDataPacket } from 'mysql2';

// Helper functions
export const generateSecret = (options: { length: number }) => {
  return speakeasy.generateSecret({
    length: options.length
  });
};

// Helper functions
export const verify2FAToken = async (walletAddress: string, token: string): Promise<boolean> => {
  try {
    const secret = await get2FASecret(walletAddress);
    if (!secret) {
      return false;
    }

    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return false;
  }
};

export const check2FAStatus = async (walletAddress: string): Promise<boolean> => {
  try {
    const secret = await get2FASecret(walletAddress);
    return !!secret;
  } catch (error) {
    console.error('2FA status check error:', error);
    return false;
  }
};

// Database functions
export const store2FASecret = async (walletAddress: string, secret: string): Promise<void> => {
  try {
    await pool.execute<RowDataPacket[]>(
      'INSERT INTO user_2fa_secrets (wallet_address, secret) VALUES (?, ?) ON DUPLICATE KEY UPDATE secret = ?',
      [walletAddress, secret, secret]
    );
  } catch (error) {
    console.error('Error storing 2FA secret:', error);
    throw error;
  }
};

export const get2FASecret = async (walletAddress: string): Promise<string | null> => {
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT secret FROM user_2fa_secrets WHERE wallet_address = ?',
      [walletAddress]
    );
    return rows.length > 0 ? (rows[0].secret as string) : null;
  } catch (error) {
    console.error('Error retrieving 2FA secret:', error);
    return null;
  }
};

// Middleware for 2FA verification
export const twoFactorMiddleware: RequestHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Check if 2FA is enabled for this user
    const is2FAEnabled = await check2FAStatus(req.user.wallet_address);
    
    if (is2FAEnabled) {
      // Check if 2FA token is provided in headers
      const twoFactorToken = req.headers['x-2fa-token'] as string;
      
      if (!twoFactorToken) {
        return res.status(401).json({
          success: false,
          message: '2FA token required'
        });
      }

      // Verify the 2FA token
      const isValid = await verify2FAToken(req.user.wallet_address, twoFactorToken);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid 2FA token'
        });
      }
    }

    next();
  } catch (error) {
    console.error('2FA middleware error:', error);
    res.status(500).json({
      success: false,
      message: '2FA verification failed'
    });
  }
};

const setup2FA = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name: 'KaiLaunchpad',
      length: 20
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(`otpauth://totp/${secret.name}?secret=${secret.base32}&issuer=KaiLaunchpad`);

    // Store the secret for this user
    await store2FASecret(req.user.wallet_address, secret.base32);

    res.json({
      success: true,
      message: '2FA setup successful',
      secret: secret.base32,
      qrCodeUrl
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup 2FA'
    });
  }
};
