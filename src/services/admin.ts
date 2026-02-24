import { authService } from './auth';

// Use environment variable if available, otherwise default to local API
export const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface ContractBalanceResponse {
  success: boolean;
  balance: string;
  balanceWei: string;
  contractAddress: string;
  owner: string;
  message?: string;
  error?: string;
}

export interface WithdrawalResponse {
  success: boolean;
  message: string;
  transactionHash?: string;
  from?: string;
  error?: string;
}

export interface AdminAuthResponse {
  success: boolean;
  message: string;
  walletAddress?: string;
  adminToken?: string;
  error?: string;
}

export const adminService = {
  /**
   * Authenticate as admin directly
   */
  async adminAuth(walletAddress: string): Promise<AdminAuthResponse> {
    try {
      console.log('Attempting admin authentication for wallet:', walletAddress);
      const response = await fetch(`${API_URL}/auth/admin-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ walletAddress })
      });
      
      const data = await response.json();
      
      if (data.success && data.adminToken) {
        // Store the admin token in localStorage
        localStorage.setItem('admin_token', data.adminToken);
        localStorage.setItem('is_admin', 'true');
        console.log('Admin authentication successful');
      } else {
        console.error('Admin authentication failed:', data.message);
        localStorage.removeItem('admin_token');
        localStorage.setItem('is_admin', 'false');
      }
      
      return data;
    } catch (error) {
      console.error('Admin authentication error:', error);
      localStorage.removeItem('admin_token');
      localStorage.setItem('is_admin', 'false');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  /**
   * Get the admin auth headers
   */
  getAdminHeaders() {
    const adminToken = localStorage.getItem('admin_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    // Always include wallet address for 2FA
    const walletAddress = localStorage.getItem('wallet_address');
    if (walletAddress) {
      headers['x-wallet-address'] = walletAddress;
    }
    
    if (adminToken) {
      headers['x-admin-token'] = adminToken;
    } else {
      // Fallback to standard auth header
      const authHeader = authService.getAuthHeader();
      Object.assign(headers, authHeader);
    }
    
    return headers;
  },
  
  /**
   * Get the current balance of the NFT contract
   */
  async getContractBalance(): Promise<ContractBalanceResponse> {
    try {
      const response = await fetch(`${API_URL}/admin/contract-balance`, {
        method: 'GET',
        headers: this.getAdminHeaders()
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting contract balance:', error);
      return {
        success: false,
        balance: '0',
        balanceWei: '0',
        contractAddress: '',
        owner: '',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  /**
   * Withdraw funds from the NFT contract
   * @param privateKey The private key of the contract owner
   */
  async withdrawFunds(privateKey: string): Promise<WithdrawalResponse> {
    try {
      const response = await fetch(`${API_URL}/admin/withdraw-funds`, {
        method: 'POST',
        headers: this.getAdminHeaders(),
        body: JSON.stringify({ privateKey })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  /**
   * Check if the current user is an admin
   */
  isAdmin(): boolean {
    // We'll implement this with a simple localStorage check for now
    // In a production app, you'd want to verify this with the server
    return localStorage.getItem('is_admin') === 'true';
  },
  
  /**
   * Set admin status in localStorage
   */
  setAdminStatus(isAdmin: boolean): void {
    localStorage.setItem('is_admin', isAdmin ? 'true' : 'false');
  }
};
