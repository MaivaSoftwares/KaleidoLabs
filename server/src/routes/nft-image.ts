import { Router } from 'express';
import { pool } from '../config/database';
import metadataService from '../services/metadata';
import { JsonRpcProvider } from 'ethers';
import { Contract } from 'ethers';
import path from 'path';

const router = Router();

// Serve NFT image
router.get('/metadata/:tokenId/image', async (req, res) => {
  try {
    // Serve the GIF file directly from public directory
    res.sendFile('nft.gif', { root: path.join(__dirname, '../../public') });
  } catch (error) {
    console.error('Error serving NFT image:', error);
    res.status(404).send('Image not found');
  }
});

export default router;
