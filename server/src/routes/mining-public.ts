import express from 'express';
import { pool } from '../config/database';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

// Middleware to validate API key
const validateApiKey = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }
  
  // In a production environment, you would validate against stored API keys
  // For now, we'll use a simple check against environment variable
  if (apiKey !== process.env.EXTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  next();
};

/**
 * Get mining status for a wallet address
 * 
 * @route GET /api/mining/public/status/:address
 * @param {string} address - Wallet address
 * @returns {Object} Mining status information
 */
router.get('/status/:address', validateApiKey, async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    
    // First check if this is a linked wallet
    const [linkedWallets] = await pool.query(
      `SELECT * FROM wallet_links 
       WHERE kalaido_wallet = ? AND is_active = 1`,
      [address]
    );
    
    let walletToCheck = address;
    let isLinkedWallet = false;
    
    // If this is a linked wallet, use the launchpad wallet for checking mining status
    if (linkedWallets && (linkedWallets as any[]).length > 0) {
      walletToCheck = (linkedWallets as any[])[0].launchpad_wallet;
      isLinkedWallet = true;
      console.log(`Using linked Launchpad wallet ${walletToCheck} for Kalaido wallet ${address}`);
    }
    
    // Get the active mining session for this wallet if it exists
    const [sessions] = await pool.query(
      `SELECT * FROM mining_sessions 
       WHERE user_address = ? AND end_time IS NULL 
       ORDER BY start_time DESC LIMIT 1`,
      [walletToCheck]
    );
    
    // Get the user's total points from the user_points table regardless of mining status
    const [userPointsResult] = await pool.query(
      `SELECT total_points FROM user_points WHERE user_address = ?`,
      [walletToCheck]
    );
    
    // Get total points from user_points or default to 0
    const totalPoints = userPointsResult && (userPointsResult as any[]).length > 0 
      ? parseFloat((userPointsResult as any[])[0].total_points) 
      : 0;
    
    if (!sessions || (sessions as any[]).length === 0) {
      return res.json({
        success: true,
        status: {
          isActive: false,
          address: address,
          startTime: null,
          cpuCount: 0,
          miningRate: 0,
          points: 0,
          sessionPoints: 0,
          totalPoints: totalPoints,
          linkedWallet: isLinkedWallet ? walletToCheck : undefined
        }
      });
    }
    
    const session = (sessions as any[])[0];
    
    // Get mining rate for client-side calculation
    const miningRate = parseFloat(session.mining_rate);
    
    return res.json({
      success: true,
      status: {
        isActive: true,
        address: address,
        startTime: session.start_time,
        cpuCount: session.cpu_count,
        miningRate: session.mining_rate,
        points: session.points,
        totalPoints: totalPoints,
        linkedWallet: isLinkedWallet ? walletToCheck : undefined
      }
    });
  } catch (error) {
    console.error('Error getting mining status:', error);
    // Return more detailed error information for debugging
    return res.status(500).json({ 
      error: 'Failed to get mining status', 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Link a Kalaido wallet to a Launchpad wallet
 */
router.post('/wallet/link', validateApiKey, async (req, res) => {
  try {
    // Support both camelCase and snake_case parameter names for backward compatibility
    const kalaidoWallet = req.body.kalaidoWallet || req.body.kalaido_wallet;
    const launchpadWallet = req.body.launchpadWallet || req.body.launchpad_wallet;
    const projectId = req.body.projectId || 'default'; // Make projectId optional with a default value
    
    // Validate input
    if (!kalaidoWallet || !launchpadWallet) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: Kalaido wallet and Launchpad wallet addresses are required' 
      });
    }
    
    if (!kalaidoWallet.startsWith('0x') || kalaidoWallet.length !== 42) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Kalaido wallet address format' 
      });
    }
    
    if (!launchpadWallet.startsWith('0x') || launchpadWallet.length !== 42) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Launchpad wallet address format' 
      });
    }
    
    // Check if the Launchpad wallet is already linked to any Kalaido wallet
    const [existingLaunchpadLinks] = await pool.query(
      'SELECT * FROM wallet_links WHERE launchpad_wallet = ? AND is_active = 1',
      [launchpadWallet]
    );
    
    if (existingLaunchpadLinks && (existingLaunchpadLinks as any[]).length > 0) {
      const existingLink = (existingLaunchpadLinks as any[])[0];
      
      // If this Launchpad wallet is already linked to a different Kalaido wallet
      if (existingLink.kalaido_wallet !== kalaidoWallet) {
        return res.status(400).json({
          success: false,
          error: `This Launchpad wallet is already linked to another Kalaido wallet (${existingLink.kalaido_wallet.substring(0, 6)}...${existingLink.kalaido_wallet.substring(38)})`
        });
      }
    }
    
    // Check if this specific wallet pair is already linked
    const [existingLinks] = await pool.query(
      'SELECT * FROM wallet_links WHERE kalaido_wallet = ? AND launchpad_wallet = ?',
      [kalaidoWallet, launchpadWallet]
    );
    
    if (existingLinks && (existingLinks as any[]).length > 0) {
      const existingLink = (existingLinks as any[])[0];
      
      // If it's already active, just return success
      if (existingLink.is_active) {
        return res.json({
          success: true,
          message: 'Wallet link already exists and is active',
          linkId: existingLink.id,
          kalaidoWallet: existingLink.kalaido_wallet,
          launchpadWallet: existingLink.launchpad_wallet
        });
      }
      
      // If it exists but is inactive, reactivate it
      await pool.query(
        'UPDATE wallet_links SET is_active = 1, updated_at = NOW(), project_id = ? WHERE id = ?',
        [projectId, existingLink.id]
      );
      
      return res.json({
        success: true,
        message: 'Wallet link reactivated',
        linkId: existingLink.id,
        kalaidoWallet: existingLink.kalaido_wallet,
        launchpadWallet: existingLink.launchpad_wallet
      });
    }
    
    // Create a new wallet link
    const [result] = await pool.query(
      `INSERT INTO wallet_links (
        kalaido_wallet, 
        launchpad_wallet, 
        project_id, 
        is_active, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [kalaidoWallet, launchpadWallet, projectId]
    );
    
    return res.json({
      success: true,
      message: 'Wallet link created successfully',
      linkId: (result as any).insertId,
      kalaidoWallet: kalaidoWallet,
      launchpadWallet: launchpadWallet
    });
  } catch (error) {
    console.error('Error linking wallets:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to link wallets', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Register a webhook for mining status updates
 * 
 * @route POST /api/mining/public/webhook/register
 * @param {string} callbackUrl - URL to receive webhook notifications
 * @param {string} walletAddress - Wallet address to monitor
 * @param {string} projectId - External project identifier
 * @returns {Object} Registration confirmation
 */
router.post('/webhook/register', validateApiKey, async (req, res) => {
  try {
    const { callbackUrl, walletAddress, projectId } = req.body;
    const apiKey = req.headers['x-api-key'] as string;
    
    // Validate required fields
    if (!callbackUrl || !walletAddress || !projectId) {
      return res.status(400).json({ 
        error: 'Missing required fields: callbackUrl, walletAddress, and projectId are required' 
      });
    }
    
    // Validate wallet address format
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    // Check if this is a Kalaido wallet linked to a Launchpad wallet
    const [linkedWallets] = await pool.query(
      'SELECT launchpad_wallet FROM wallet_links WHERE kalaido_wallet = ? AND is_active = 1',
      [walletAddress]
    );
    
    // If this is a linked Kalaido wallet, use the Launchpad wallet for registration
    let walletToRegister = walletAddress;
    if (linkedWallets && (linkedWallets as any[]).length > 0) {
      walletToRegister = (linkedWallets as any[])[0].launchpad_wallet;
      console.log(`Using linked Launchpad wallet ${walletToRegister} for Kalaido wallet ${walletAddress}`);
    }
    
    // Check if registration already exists
    const [existingRegistrations] = await pool.query(
      'SELECT * FROM webhook_registrations WHERE project_id = ? AND wallet_address = ?',
      [projectId, walletToRegister]
    );
    
    if ((existingRegistrations as any[]).length > 0) {
      // Update existing registration
      await pool.query(
        `UPDATE webhook_registrations 
         SET callback_url = ?, is_active = TRUE, updated_at = NOW() 
         WHERE project_id = ? AND wallet_address = ?`,
        [callbackUrl, projectId, walletToRegister]
      );
      
      return res.json({
        success: true,
        message: 'Webhook registration updated',
        registrationId: (existingRegistrations as any[])[0].id,
        // Include information about the linked wallet if applicable
        originalWallet: walletAddress !== walletToRegister ? walletAddress : undefined,
        registeredWallet: walletToRegister
      });
    }
    
    // Create new registration
    const [result] = await pool.query(
      `INSERT INTO webhook_registrations 
       (project_id, wallet_address, callback_url, api_key) 
       VALUES (?, ?, ?, ?)`,
      [projectId, walletToRegister, callbackUrl, apiKey]
    );
    
    // Get the registration ID
    const registrationId = (result as any).insertId;
    
    // Send current mining status immediately as first notification
    const [sessions] = await pool.query(
      `SELECT * FROM mining_sessions 
       WHERE user_address = ? AND end_time IS NULL 
       ORDER BY start_time DESC LIMIT 1`,
      [walletToRegister]
    );
    
    const isActive = (sessions as any[]).length > 0;
    const session = isActive ? (sessions as any[])[0] : null;
    
    // Try to send initial webhook (but don't fail registration if it fails)
    try {
      await axios.post(callbackUrl, {
        event: 'mining_status',
        walletAddress: walletAddress, // Send the original wallet address in the notification
        registeredWallet: walletToRegister, // Also include the registered wallet if different
        status: {
          isActive,
          startTime: session ? session.start_time : null,
          cpuCount: session ? session.cpu_count : 0,
          miningRate: session ? session.mining_rate : 0,
          points: session ? session.points : 0
        },
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET || 'webhook-secret')
            .update(JSON.stringify({ walletAddress: walletToRegister, isActive }))
            .digest('hex')
        },
        timeout: 5000 // 5 second timeout
      });
      
      // Update last notified timestamp
      await pool.query(
        'UPDATE webhook_registrations SET last_notified_at = NOW() WHERE id = ?',
        [registrationId]
      );
    } catch (webhookError) {
      console.error('Failed to send initial webhook notification:', webhookError);
      console.error('Webhook payload:', {
        event: 'mining_status',
        walletAddress: walletAddress,
        registeredWallet: walletToRegister,
        status: {
          isActive,
          startTime: session ? session.start_time : null,
          cpuCount: session ? session.cpu_count : 0,
          miningRate: session ? session.mining_rate : 0,
          points: session ? session.points : 0
        }
      });
      console.error('Callback URL:', callbackUrl);
      // Continue with registration despite webhook failure
    }
    
    return res.json({
      success: true,
      message: 'Webhook registered successfully',
      registrationId,
      // Include information about the linked wallet if applicable
      originalWallet: walletAddress !== walletToRegister ? walletAddress : undefined,
      registeredWallet: walletToRegister
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    return res.status(500).json({ error: 'Failed to register webhook' });
  }
});

/**
 * Unregister a webhook
 * 
 * @route POST /api/mining/public/webhook/unregister
 * @param {string} projectId - External project identifier
 * @param {string} walletAddress - Wallet address to stop monitoring
 * @returns {Object} Unregistration confirmation
 */
router.post('/webhook/unregister', validateApiKey, async (req, res) => {
  try {
    const { projectId, walletAddress } = req.body;
    
    if (!projectId || !walletAddress) {
      return res.status(400).json({ error: 'projectId and walletAddress are required' });
    }
    
    // Check if this is a Kalaido wallet linked to a Launchpad wallet
    const [linkedWallets] = await pool.query(
      'SELECT launchpad_wallet FROM wallet_links WHERE kalaido_wallet = ? AND is_active = 1',
      [walletAddress]
    );
    
    // If this is a linked Kalaido wallet, use the Launchpad wallet for unregistration
    let walletToUnregister = walletAddress;
    if (linkedWallets && (linkedWallets as any[]).length > 0) {
      walletToUnregister = (linkedWallets as any[])[0].launchpad_wallet;
      console.log(`Using linked Launchpad wallet ${walletToUnregister} for Kalaido wallet ${walletAddress}`);
    }
    
    // Soft delete by setting is_active to false
    await pool.query(
      'UPDATE webhook_registrations SET is_active = FALSE WHERE project_id = ? AND wallet_address = ?',
      [projectId, walletToUnregister]
    );
    
    return res.json({
      success: true,
      message: 'Webhook unregistered successfully',
      // Include information about the linked wallet if applicable
      originalWallet: walletAddress !== walletToUnregister ? walletAddress : undefined,
      unregisteredWallet: walletToUnregister
    });
  } catch (error) {
    console.error('Error unregistering webhook:', error);
    return res.status(500).json({ error: 'Failed to unregister webhook' });
  }
});



export default router;
