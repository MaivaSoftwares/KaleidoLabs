
export interface NFTProject {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  mintDate: string;
  price: string;
  totalSupply: number;
  remaining: number;
  artist: string;
  status: 'upcoming' | 'live' | 'ended';
}

// Single NFT collection
export const nftCollection: NFTProject = {
  id: '1',
  title: 'Neon Dreams',
  description: 'A collection of dreamlike landscapes inspired by cyberpunk aesthetics and digital nostalgia. Each piece in this limited collection captures the essence of a futuristic world bathed in neon lights and digital ambiance.',
  imageUrl: '/neon-dreams.jpg',
  mintDate: '2025-05-15T16:00:00Z',
  price: '0.08 ETH',
  totalSupply: 2000,
  remaining: 1824,
  artist: 'Synthwave Collective',
  status: 'live',
};

// For compatibility with existing code
export const featuredProjects: NFTProject[] = [nftCollection];

export const getUserNFTs = (address: string | null) => {
  if (!address) return [];
  
  // In a real application, we would fetch the user's NFTs from the blockchain
  // For now, we'll return mock data for the connected wallet
  const mockUserNfts = [
    {
      id: 'user-1',
      title: 'Neon Dreams #342',
      imageUrl: '/neon-dreams.jpg',
      mintedDate: '2025-05-01T14:32:00Z'
    }
  ];
  
  return mockUserNfts;
};

// Simulate minting an NFT
export const mintNFT = async (projectId: string, address: string | null): Promise<boolean> => {
  if (!address) return false;
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Simulate 90% success rate
  const success = Math.random() > 0.1;
  
  return success;
};
