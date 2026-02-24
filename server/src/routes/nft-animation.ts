import { Router } from 'express';

const router = Router();

// Serve NFT animation
router.get('/metadata/:tokenId/animation', (req, res) => {
  res.sendFile('nft.gif', { root: './public' });
});

export default router;
