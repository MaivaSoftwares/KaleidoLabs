import { authService } from './auth';
import { adminService, API_URL } from './admin';

export interface TwoFactorSetupResponse {
  success: boolean;
  message: string;
  secret: string;
  qrCodeUrl: string;
  error?: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  message?: string;
}

export const twoFactorService = {
  /**
   * Generate a new 2FA secret and QR code for the user
   */
  async setupTwoFactor(): Promise<TwoFactorSetupResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('admin_token') || ''
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          message: data.message || 'Failed to setup 2FA',
          secret: '',
          qrCodeUrl: '',
          error: data.error || 'Failed to setup 2FA'
        };
      }
      
      return {
        success: true,
        message: data.message || '2FA setup successful',
        secret: data.secret || '',
        qrCodeUrl: data.qrCodeUrl || ''
      };
    } catch (error) {
      console.error('2FA setup error:', error);
      return {
        success: false,
        message: 'Failed to setup 2FA',
        secret: '',
        qrCodeUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Verify a 2FA code
   */
  async verifyCode(token: string): Promise<TwoFactorVerifyResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': localStorage.getItem('admin_token') || ''
        },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          message: data.message || 'Invalid 2FA code',
          error: data.error || 'Invalid 2FA code'
        };
      }
      
      return {
        success: true,
        message: data.message || '2FA verified successfully'
      };
    } catch (error) {
      console.error('2FA verification error:', error);
      return {
        success: false,
        message: 'Failed to verify 2FA code',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Check if 2FA is enabled for the current user
   */
  async isTwoFactorEnabled(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/2fa/status`, {
        method: 'GET',
        headers: {
          'x-admin-token': localStorage.getItem('admin_token') || ''
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        console.error('2FA status check error:', data.message);
        return false;
      }
      
      return data.enabled;
    } catch (error) {
      console.error('2FA status check error:', error);
      return false;
    }
  }
};
