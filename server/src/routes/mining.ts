import { Router } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import webhookService from '../services/webhook';

dotenv.config();

// NFT contract ABI (only the balanceOf function needed for verification)
const NFT_ABI = [
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
];

// Constants for mining rate calculation
const BASE_MINING_RATE = 0.0045; // Base mining rate per CPU per second

interface MiningSessionRow extends RowDataPacket {
  id: number;
  user_address: string;
  start_time: Date;
  end_time: Date | null;
  cpu_count: number;
  cores_per_cpu: number;
  ram_per_cpu: number;
  mining_rate: number;
  total_points: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface UserPointsRow extends RowDataPacket {
  id: number;
  user_address: string;
  total_points: number;
  created_at: Date;
  updated_at: Date;
}

// Helper function to verify NFT ownership on-chain
async function verifyNFTOwnership(walletAddress: string, chainId: number): Promise<number> {
  try {
    // Get contract address and RPC URL from environment variables based on chain ID
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    
    if (!contractAddress || !rpcUrl) {
      console.error('Missing contract address or RPC URL in environment variables');
      return 0;
    }
    
    // Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider);
    
    // Call balanceOf to get the number of NFTs owned by the wallet
    const balance = await contract.balanceOf(walletAddress);
    return parseInt(balance.toString());
  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    return 0; // Return 0 on error to be safe
  }
}

// Helper function to calculate the correct mining rate based on CPU count and NFT ownership
function calculateMiningRate(cpuCount: number, nftCount: number): number {
  // Ensure CPU count doesn't exceed NFT count
  const validCpuCount = Math.min(cpuCount, Math.max(nftCount, 1));
  
  // Calculate mining rate based on valid CPU count
  return BASE_MINING_RATE * validCpuCount;
}

const router = Router();

// Start a mining session
router.post('/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { cpuCount, coresPerCpu, ramPerCpu, chainId } = req.body;
    
    if (!req.user?.wallet_address) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const userAddress = req.user.wallet_address;
    
    // Verify NFT ownership on-chain
    const nftCount = await verifyNFTOwnership(userAddress, chainId || 1); // Default to chain ID 1 if not provided
    
    // Validate CPU count against NFT ownership
    const validCpuCount = Math.min(cpuCount, Math.max(nftCount, 1));
    
    // Calculate the correct mining rate based on valid CPU count
    const validMiningRate = calculateMiningRate(validCpuCount, nftCount);
    
    // If the requested CPU count exceeds NFT ownership, return an error
    if (validCpuCount < cpuCount) {
      return res.status(400).json({
        success: false,
        message: `You can only use up to ${nftCount} CPUs based on your NFT ownership`,
        validCpuCount,
        nftCount
      });
    }
    
    // End any active sessions for this user
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // End any active sessions
      await connection.execute(
        'UPDATE mining_sessions SET is_active = false, end_time = NOW() WHERE user_address = ? AND is_active = true',
        [userAddress]
      );
      
      // Calculate points for any sessions that were ended
      const [activeSessions] = await connection.execute<MiningSessionRow[]>(
        `SELECT id, start_time, mining_rate FROM mining_sessions 
         WHERE user_address = ? AND end_time IS NOT NULL AND total_points = 0`,
        [userAddress]
      );
      
      for (const session of activeSessions) {
        const startTime = new Date(session.start_time).getTime();
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        const points = session.mining_rate * durationSeconds;
        
        await connection.execute(
          'UPDATE mining_sessions SET total_points = ? WHERE id = ?',
          [points, session.id]
        );
        
        // Update user's total points
        await connection.execute(
          `INSERT INTO user_points (user_address, total_points) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE total_points = total_points + ?`,
          [userAddress, points, points]
        );
      }
      
      // Start a new mining session with validated parameters
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO mining_sessions 
         (user_address, start_time, cpu_count, cores_per_cpu, ram_per_cpu, mining_rate, is_active) 
         VALUES (?, NOW(), ?, ?, ?, ?, true)`,
        [userAddress, validCpuCount, coresPerCpu, ramPerCpu, validMiningRate]
      );
      
      await connection.commit();
      
      // Get the session ID for the new session
      const sessionId = result.insertId;
      
      // Notify webhooks about the mining status change
      webhookService.notifyMiningStatusChange(userAddress, {
        isActive: true,
        startTime: new Date(),
        cpuCount: validCpuCount,
        miningRate: validMiningRate,
        points: 0
      }).catch(webhookError => {
        // Log but don't fail the request if webhook notification fails
        console.error('Error sending webhook notifications:', webhookError);
      });
      
      res.json({ 
        success: true, 
        message: 'Mining session started',
        sessionId
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error starting mining session:', error);
    res.status(500).json({ success: false, message: 'Failed to start mining session' });
  }
});

// Stop a mining session
router.post('/stop', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { totalPoints } = req.body;
    
    if (!req.user?.wallet_address) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const userAddress = req.user.wallet_address;
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Get the active session to verify points
      const [sessions] = await connection.execute<MiningSessionRow[]>(
        `SELECT id, start_time, mining_rate, cpu_count FROM mining_sessions 
         WHERE user_address = ? AND is_active = true`,
        [userAddress]
      );
      
      if (sessions.length === 0) {
        return res.status(404).json({ success: false, message: 'No active mining session found' });
      }
      
      const session = sessions[0];
      const startTime = new Date(session.start_time).getTime();
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      
      // Calculate points on the server side
      const serverCalculatedPoints = session.mining_rate * durationSeconds;
      
      // Use server-calculated points instead of client-provided points
      // Add a dynamic tolerance based on session duration
      // Shorter sessions may have more timing discrepancies due to network latency
      const baseTolerance = 0.05; // 5% base tolerance
      const dynamicTolerance = Math.max(baseTolerance, 0.10 / Math.sqrt(durationSeconds)); // Higher tolerance for shorter sessions
      
      const lowerBound = serverCalculatedPoints * (1 - dynamicTolerance);
      const upperBound = serverCalculatedPoints * (1 + dynamicTolerance);
      
      // If client points are outside the tolerance range, log it and use server calculation
      let pointsToAward = serverCalculatedPoints;
      let potentialManipulation = false;
      let manipulationSeverity = 'none';
      
      // Check if client-reported points are outside the tolerance range
      if (totalPoints < lowerBound || totalPoints > upperBound) {
        // Calculate the percentage difference
        const percentDiff = Math.abs((totalPoints - serverCalculatedPoints) / serverCalculatedPoints) * 100;
        
        // Determine severity based on the percentage difference
        if (percentDiff > 30) {
          manipulationSeverity = 'high';
        } else if (percentDiff > 15) {
          manipulationSeverity = 'medium';
        } else {
          manipulationSeverity = 'low';
        }
        
        console.warn(
          `Potential mining rate manipulation detected for wallet ${userAddress}. ` +
          `Client reported ${totalPoints} points, server calculated ${serverCalculatedPoints} points. ` +
          `Difference: ${percentDiff.toFixed(2)}% (${manipulationSeverity} severity)`
        );
        
        potentialManipulation = true;
        
        // Store the manipulation attempt in the database for tracking
        try {
          await connection.execute(
            `INSERT INTO mining_anomalies (user_address, session_id, client_points, server_points, 
             difference_percent, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [userAddress, session.id, totalPoints, serverCalculatedPoints, percentDiff, manipulationSeverity]
          );
        } catch (anomalyError) {
          // Log but don't fail the transaction if we can't record the anomaly
          console.error('Failed to record mining anomaly:', anomalyError);
        }
      }
      
      // End the active session with server-calculated points
      await connection.execute(
        `UPDATE mining_sessions 
         SET is_active = false, end_time = NOW(), total_points = ? 
         WHERE id = ?`,
        [pointsToAward, session.id]
      );
      
      // Update user's total points
      await connection.execute(
        `INSERT INTO user_points (user_address, total_points) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE total_points = total_points + ?`,
        [userAddress, pointsToAward, pointsToAward]
      );
      
      await connection.commit();
      
      // Notify webhooks about the mining status change
      webhookService.notifyMiningStatusChange(userAddress, {
        isActive: false,
        startTime: null,
        cpuCount: 0,
        miningRate: 0,
        points: pointsToAward
      }).catch(webhookError => {
        // Log but don't fail the request if webhook notification fails
        console.error('Error sending webhook notifications:', webhookError);
      });
      
      res.json({ 
        success: true, 
        message: 'Mining session stopped',
        pointsAwarded: pointsToAward,
        clientReported: totalPoints,
        serverCalculated: serverCalculatedPoints,
        potentialManipulation
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error stopping mining session:', error);
    res.status(500).json({ success: false, message: 'Failed to stop mining session' });
  }
});

// Get public mining status for a wallet
router.get('/public/status/:walletAddress', async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress;
    
    // Check if there's an active mining session
    const [activeSession] = await pool.query<MiningSessionRow[]>(
      'SELECT * FROM mining_sessions WHERE user_address = ? AND is_active = TRUE',
      [walletAddress]
    );

    const isActive = activeSession.length > 0;
    
    res.json({
      success: true,
      isActive,
      miningRate: isActive ? activeSession[0].mining_rate : 0,
      cpuCount: isActive ? activeSession[0].cpu_count : 0
    });
  } catch (error) {
    console.error('Error checking mining status:', error);
    res.status(500).json({ success: false, message: 'Failed to check mining status' });
  }
});

// Get user's mining stats
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.wallet_address) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const userAddress = req.user.wallet_address;
    console.log(`Getting mining stats for wallet: ${userAddress}`);
    
    const connection = await pool.getConnection();
    
    try {
      // Get user's total points
      const [pointsResult] = await connection.execute<UserPointsRow[]>(
        'SELECT total_points FROM user_points WHERE user_address = ?',
        [userAddress]
      );
      
      console.log('Points result from database:', pointsResult);
      
      // Calculate total points from completed mining sessions if no entry in user_points
      let totalPoints = 0;
      
      if (pointsResult.length > 0) {
        totalPoints = parseFloat(pointsResult[0].total_points.toString());
        console.log(`Found total points in user_points table: ${totalPoints}`);
      } else {
        // If no entry in user_points, calculate from completed sessions
        const [completedSessions] = await connection.execute<MiningSessionRow[]>(
          `SELECT SUM(total_points) as total FROM mining_sessions 
           WHERE user_address = ? AND is_active = false AND total_points > 0`,
          [userAddress]
        );
        
        if (completedSessions.length > 0 && completedSessions[0].total) {
          totalPoints = parseFloat(completedSessions[0].total.toString());
          console.log(`Calculated total points from sessions: ${totalPoints}`);
          
          // Create an entry in user_points
          await connection.execute(
            `INSERT INTO user_points (user_address, total_points) 
             VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE total_points = ?`,
            [userAddress, totalPoints, totalPoints]
          );
        }
      }
      
      // Get user's active session if any
      const [sessionResult] = await connection.execute<MiningSessionRow[]>(
        `SELECT id, start_time, cpu_count, cores_per_cpu, ram_per_cpu, mining_rate 
         FROM mining_sessions 
         WHERE user_address = ? AND is_active = true`,
        [userAddress]
      );
      
      // Get user's mining history
      const [historyResult] = await connection.execute<MiningSessionRow[]>(
        `SELECT id, start_time, end_time, cpu_count, cores_per_cpu, ram_per_cpu, mining_rate, total_points
         FROM mining_sessions 
         WHERE user_address = ? AND is_active = false
         ORDER BY end_time DESC
         LIMIT 10`,
        [userAddress]
      );
      
      const activeSession = sessionResult.length > 0 ? sessionResult[0] : null;
      
      // Log the response for debugging
      console.log(`Returning stats for ${userAddress}: totalPoints=${totalPoints}, hasActiveSession=${!!activeSession}`);
      
      res.json({ 
        success: true,
        totalPoints,
        activeSession,
        history: historyResult
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting mining stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get mining stats' });
  }
});

// Get global mining leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const [leaderboard] = await pool.execute<UserPointsRow[]>(
      `SELECT user_address, total_points 
       FROM user_points 
       ORDER BY total_points DESC 
       LIMIT 10`
    );
    
    res.json({ 
      success: true,
      leaderboard
    });
  } catch (error) {
    console.error('Error getting mining leaderboard:', error);
    res.status(500).json({ success: false, message: 'Failed to get mining leaderboard' });
  }
});

export default router;
