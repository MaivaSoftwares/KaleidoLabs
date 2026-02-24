import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { authService } from '@/services/auth';

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isAuthenticated());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status when wallet connection changes
  useEffect(() => {
    if (!isConnected) {
      // If wallet is disconnected, clear authentication
      authService.logout();
      setIsAuthenticated(false);
      setError(null);
    } else {
      // If wallet is connected, check if we're authenticated
      setIsAuthenticated(authService.isAuthenticated());
    }
  }, [isConnected, address]);

  // Logout function
  const logout = () => {
    authService.logout();
    disconnect();
    setIsAuthenticated(false);
  };

  // Get user profile
  const getUserProfile = async () => {
    if (!isAuthenticated || !address) return null;
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/profile', {
        headers: {
          ...authService.getAuthHeader()
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to fetch user profile');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    logout,
    getUserProfile
  };
}
