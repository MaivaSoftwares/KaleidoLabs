import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminAuth';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// NFT contract ABI (only the withdraw function needed)
const NFT_ABI = [
  {
    "inputs": [],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBalance",
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

// Get contract balance
router.get('/contract-balance', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    
    if (!contractAddress || !rpcUrl) {
      return res.status(500).json({ 
        success: false, 
        message: 'Missing contract configuration in environment variables' 
      });
    }
    
    // Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Get contract balance
    const balance = await provider.getBalance(contractAddress);
    
    // Get contract owner
    const contract = new ethers.Contract(contractAddress, NFT_ABI, provider);
    let owner;
    try {
      owner = await contract.owner();
    } catch (error) {
      console.error('Error getting contract owner:', error);
      owner = 'Unknown (owner() function not available)';
    }
    
    res.json({
      success: true,
      balance: ethers.formatEther(balance),
      balanceWei: balance.toString(),
      contractAddress,
      owner
    });
  } catch (error) {
    console.error('Error getting contract balance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get contract balance',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Withdraw funds from contract
router.post('/withdraw-funds', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Private key is required for withdrawal' 
      });
    }
    
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
    const rpcUrl = process.env.RPC_URL;
    
    if (!contractAddress || !rpcUrl) {
      return res.status(500).json({ 
        success: false, 
        message: 'Missing contract configuration in environment variables' 
      });
    }
    
    // Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, NFT_ABI, wallet);
    
    // Get contract owner
    let owner;
    try {
      owner = await contract.owner();
      
      // Check if the wallet is the contract owner
      if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        return res.status(403).json({ 
          success: false, 
          message: 'The provided wallet is not the contract owner',
          owner,
          walletAddress: wallet.address
        });
      }
    } catch (error) {
      console.error('Error checking contract owner:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to verify contract ownership',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Call the withdraw function
    const tx = await contract.withdraw();
    
    res.json({
      success: true,
      message: 'Withdrawal transaction submitted',
      transactionHash: tx.hash,
      from: wallet.address
    });
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to withdraw funds',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
