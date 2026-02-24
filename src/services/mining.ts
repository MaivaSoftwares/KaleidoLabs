import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

// Mining service API endpoints
const API_BASE_URL = '/api/mining';

// Types
export interface MiningSession {
  id: number;
  start_time: string;
  end_time: string | null;
  cpu_count: number;
  cores_per_cpu: number;
  ram_per_cpu: number;
  mining_rate: number;
  total_points: number;
  is_active: boolean;
}

export interface MiningStats {
  totalPoints: number;
  activeSession: MiningSession | null;
  history: MiningSession[];
}

export interface LeaderboardEntry {
  user_address: string;
  total_points: number;
}

/**
 * Mining service for handling premium node mining operations
 */
export const miningService = {
  /**
   * Start a mining session
   * @param address User's wallet address
   * @param cpuCount Number of CPUs to use
   * @param coresPerCpu Number of cores per CPU
   * @param ramPerCpu Amount of RAM per CPU in GB
   * @param miningRate Mining rate in points per second
   * @returns Success status, session ID, and message
   */
  async startMining(
    address: string,
    cpuCount: number,
    coresPerCpu: number,
    ramPerCpu: number,
    miningRate: number
  ): Promise<{ success: boolean; sessionId?: any; message?: string; error?: any }> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/start`,
        {
          cpuCount,
          coresPerCpu,
          ramPerCpu,
          miningRate,
          chainId: 2741 // Abstract Chain ID
        },
        {
          withCredentials: true,
          headers: {
            'x-wallet-address': address
          }
        }
      );
      
      if (response.data.success) {
        return {
          success: true,
          sessionId: response.data.sessionId,
          message: response.data.message || 'Mining session started successfully'
        };
      }
      
      return {
        success: false,
        message: response.data.message || 'Failed to start mining',
        error: response.data.message || 'Failed to start mining'
      };
    } catch (error) {
      console.error('Error starting mining:', error);
      return {
        success: false,
        message: 'Failed to connect to mining server',
        error: 'Failed to connect to mining server'
      };
    }
  },
  
  /**
   * Stop an active mining session
   * @param address User's wallet address
   * @param totalPoints Total points earned in this session
   * @returns Success status, points earned, and message
   */
  async stopMining(address: string, totalPoints: number): Promise<{ success: boolean; pointsEarned?: number; message?: string; error?: any }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/stop`, {
        totalPoints
      }, {
        withCredentials: true,
        headers: {
          'x-wallet-address': address
        }
      });
      
      if (response.data.success) {
        // Get points from either pointsAwarded or pointsEarned field
        const pointsEarned = response.data.pointsAwarded || response.data.pointsEarned || 0;
        
        return {
          success: true,
          pointsEarned: pointsEarned,
          message: response.data.message || `Mining stopped successfully. You earned ${pointsEarned} points.`
        };
      }
      
      return {
        success: false,
        message: response.data.message || 'Failed to stop mining session',
        error: response.data.message || 'Failed to stop mining session'
      };
    } catch (error: any) {
      console.error('Error stopping mining session:', error);
      
      const errorMessage = error.response?.data?.message || 'Failed to stop mining session';
      
      return {
        success: false,
        message: errorMessage,
        error: errorMessage
      };
    }
  },
  
  /**
   * Get mining statistics for the current user
   * @param address User's wallet address
   * @returns Mining stats including total points, active session, and history
   */
  async getMiningStats(address: string): Promise<MiningStats | null> {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`, {
        withCredentials: true,
        headers: {
          'x-wallet-address': address
        }
      });
      
      if (response.data.success) {
        return {
          totalPoints: response.data.totalPoints,
          activeSession: response.data.activeSession,
          history: response.data.history
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching mining stats:', error);
      return null;
    }
  },
  
  /**
   * Get the mining leaderboard
   * @returns List of top miners by points
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/leaderboard`);
      
      if (response.data.success) {
        return response.data.leaderboard;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  },
  
  /**
   * Calculate mining rate based on configuration
   * @param cpuCount Number of CPUs
   * @param coresPerCpu Number of cores per CPU
   * @returns Mining rate in points per second
   */
  calculateMiningRate(cpuCount: number, coresPerCpu: number): number {
    const baseRate = 0.0045;
    const rate = baseRate * cpuCount * (coresPerCpu / 12);
    return parseFloat(rate.toFixed(8));
  }
};

export default miningService;
