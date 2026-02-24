import { Router, Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminAuth';
import { twoFactorMiddleware, verify2FAToken, check2FAStatus, store2FASecret, get2FASecret, generateSecret } from '../middleware/twoFactor';
import qrcode from 'qrcode';

const router = Router();

// Setup 2FA
router.post('/auth/2fa/setup', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Generate a new secret
    const secret = generateSecret({
      length: 20
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(`otpauth://totp/KaiLaunchpad?secret=${secret.base32}&issuer=KaiLaunchpad`);

    // Store the secret for this user
    if (!req.user || !req.user.wallet_address) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
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
});

// Verify 2FA code
router.post('/auth/2fa/verify', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    if (!req.user || !req.user.wallet_address) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const isValid = await verify2FAToken(req.user.wallet_address, token);
    
    res.json({
      success: true,
      message: isValid ? '2FA verified successfully' : 'Invalid 2FA token',
      isValid
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify 2FA token'
    });
  }
});

// Check 2FA status
router.get('/auth/2fa/status', adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !req.user.wallet_address) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const is2FAEnabled = await check2FAStatus(req.user.wallet_address);
    
    res.json({
      success: true,
      enabled: is2FAEnabled
    });
  } catch (error) {
    console.error('2FA status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check 2FA status'
    });
  }
});

export default router;
