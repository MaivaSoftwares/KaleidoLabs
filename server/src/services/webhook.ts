import axios from 'axios';
import crypto from 'crypto';
import { pool } from '../config/database';

/**
 * Service to handle webhook notifications for mining status changes
 */
export const webhookService = {
  /**
   * Notify all registered webhooks about a mining status change
   * 
   * @param walletAddress The wallet address that had a status change
   * @param status The new mining status
   */
  async notifyMiningStatusChange(
    walletAddress: string, 
    status: {
      isActive: boolean;
      startTime: Date | null;
      cpuCount: number;
      miningRate: number;
      points: number;
    }
  ): Promise<void> {
    try {
      // Get all wallet addresses that should receive this notification
      // This includes the original wallet and any linked Kalaido wallets
      const walletAddresses = [walletAddress];
      
      // Check for linked wallets
      const [linkedWallets] = await pool.query(
        'SELECT kalaido_wallet FROM wallet_links WHERE launchpad_wallet = ? AND is_active = TRUE',
        [walletAddress]
      );
      
      // Add any linked Kalaido wallets to the notification list
      if (linkedWallets && (linkedWallets as any[]).length > 0) {
        (linkedWallets as any[]).forEach(link => {
          walletAddresses.push(link.kalaido_wallet);
        });
      }
      
      // Get all active webhook registrations for all relevant wallets
      let placeholders = walletAddresses.map(() => '?').join(',');
      const [registrations] = await pool.query(
        `SELECT * FROM webhook_registrations WHERE wallet_address IN (${placeholders}) AND is_active = TRUE`,
        walletAddresses
      );
      
      if (!registrations || (registrations as any[]).length === 0) {
        // No webhooks registered for any of these wallets
        return;
      }
      
      // Prepare the webhook payload
      const basePayload = {
        event: 'mining_status',
        timestamp: new Date().toISOString(),
        status
      };
      
      // Send webhook to each registered callback
      const promises = (registrations as any[]).map(async (registration) => {
        try {
          // Check if this is a notification for a linked wallet
          const registeredWallet = registration.wallet_address;
          const isLinkedWallet = registeredWallet !== walletAddress;
          
          // Create a customized payload for this registration
          const registrationPayload = {
            ...basePayload,
            walletAddress: registeredWallet, // This is the wallet that registered for notifications
            // If the registered wallet is different from the wallet with mining activity,
            // include both so the client knows which wallet is actually mining
            registeredWallet: isLinkedWallet ? registeredWallet : undefined,
            launchpadWallet: isLinkedWallet ? walletAddress : undefined,
            projectId: registration.project_id || undefined
          };
          
          // Generate a signature specific to this payload
          const registrationSignature = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET || 'webhook-secret')
            .update(JSON.stringify({ 
              walletAddress: registeredWallet, 
              isActive: status.isActive,
              projectId: registration.project_id || undefined
            }))
            .digest('hex');
          
          await axios.post(registration.callback_url, registrationPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': registrationSignature
            },
            timeout: 5000 // 5 second timeout
          });
          
          // Update last notified timestamp
          await pool.query(
            'UPDATE webhook_registrations SET last_notified_at = NOW() WHERE id = ?',
            [registration.id]
          );
          
          console.log(`Successfully sent webhook notification to ${registration.project_id} for wallet ${registeredWallet}${isLinkedWallet ? ' (linked to ' + walletAddress + ')' : ''}`);
        } catch (error) {
          console.error(`Failed to send webhook to ${registration.callback_url}:`, error);
          // Continue with other webhooks despite this failure
        }
      });
      
      // Wait for all webhook attempts to complete
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error sending webhook notifications:', error);
    }
  }
};

export default webhookService;
