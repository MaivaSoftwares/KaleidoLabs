import axios from 'axios';
import { toast } from '@/components/ui/sonner';

// Use the same approach as auth.ts for consistency
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Cache keys
const NFT_CACHE_KEY = 'kaleido_nft_cache';
const NFT_CACHE_TIMESTAMP_KEY = 'kaleido_nft_cache_timestamp';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

export interface NFT {
  id: number;
  token_id: string;
  chain_id: number;
  transaction_hash: string;
  contract_address: string;
  metadata_uri: string;
  created_at: string;
  isOwned: boolean;
  metadata?: {
    name: string;
    description: string;
    image: string;
    attributes: {
      trait_type: string;
      value: string | number;
    }[];
  };
}

export const galleryService = {
  // Get all NFTs owned by the authenticated user - network-first with cache fallback
  async getUserNFTs(walletAddress?: string): Promise<NFT[]> {
    const authToken = localStorage.getItem('auth_token');
    // Use provided walletAddress or fall back to localStorage
    const userWalletAddress = walletAddress || localStorage.getItem('wallet_address');
    
    if (!authToken) {
      console.log('Not authenticated, returning empty NFT array');
      return [];
    }
    
    // Always try to fetch fresh data from the API first
    try {
      console.log('Attempting to fetch fresh NFT data from API...', { walletAddress: userWalletAddress });
      const response = await axios.get(`${API_URL}/nft/mints`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-wallet-address': userWalletAddress
        },
        timeout: 10000 // 10 second timeout
      });

      const nfts = response.data;

      // Fetch metadata for each NFT
      const nftsWithMetadata = await Promise.all(
        nfts.map(async (nft: NFT) => {
          try {
            const metadataResponse = await axios.get(`${API_URL}/nft/metadata/${nft.token_id}`);
            const metadata = metadataResponse.data;
            // Ensure we have a valid image URL
            if (metadata && metadata.image) {
              return {
                ...nft,
                metadata: {
                  ...metadata,
                  image: metadata.image.startsWith('http') ? metadata.image : `${API_URL}${metadata.image}`
                }
              };
            }
            return {
              ...nft,
              metadata: null
            };
          } catch (error) {
            console.error(`Error fetching metadata for NFT ${nft.token_id}:`, error);
            return {
              ...nft,
              metadata: null
            };
          }
        })
      );
      
      // Filter NFTs by ownership first
      const ownedNFTs = nftsWithMetadata.filter(nft => {
        // Only keep NFTs that are owned by the current user
        return userWalletAddress && nft.isOwned;
      });

      // Cache only the owned NFTs
      this.cacheNFTs(ownedNFTs);
      console.log('Successfully fetched and cached fresh NFT data');
      
      return ownedNFTs;
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      
      // If network request fails, fall back to cached data
      const cachedData = this.getCachedNFTs();
      if (cachedData && cachedData.length > 0) {
        console.log('Network request failed. Using cached NFT data as fallback.');
        return cachedData;
      }
      
      // Only show error toast if we don't have cached data
      toast.error('Failed to load your NFTs');
      return [];
    }
  },
  
  // Cache NFT data in localStorage
  cacheNFTs(nfts: NFT[]): void {
    try {
      localStorage.setItem(NFT_CACHE_KEY, JSON.stringify(nfts));
      localStorage.setItem(NFT_CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log('NFT data cached successfully');
    } catch (error) {
      console.error('Error caching NFT data:', error);
    }
  },
  
  // Get cached NFT data if available and not expired
  getCachedNFTs(): NFT[] | null {
    try {
      const cachedData = localStorage.getItem(NFT_CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(NFT_CACHE_TIMESTAMP_KEY);
      
      if (!cachedData || !cachedTimestamp) {
        console.log('No cached NFT data found');
        return null;
      }
      
      const timestamp = parseInt(cachedTimestamp, 10);
      const now = Date.now();
      
      // Check if cache is expired
      if (now - timestamp > CACHE_TTL) {
        console.log('Cached NFT data is expired');
        return null;
      }
      
      const nfts = JSON.parse(cachedData) as NFT[];
      console.log(`Using cached NFT data (${nfts.length} items)`);
      return nfts;
    } catch (error) {
      console.error('Error retrieving cached NFT data:', error);
      return null;
    }
  },

  // Record a new NFT mint in the database
  async recordMint(
    tokenId: string, 
    chainId: number, 
    transactionHash: string, 
    contractAddress: string,
    metadataUri: string
  ): Promise<boolean> {
    try {
      console.log(`Attempting to record mint: Token ID ${tokenId}, Chain ID ${chainId}`);
      console.log(`API URL: ${API_URL}`);
      
      const authToken = localStorage.getItem('auth_token');
      if (!authToken) {
        console.log('Not authenticated, skipping backend recording');
        return true; // Return success even if not authenticated
      }
      console.log('Auth token found, proceeding with backend recording');

      // Try to contact the backend, but don't fail the mint if it's not available
      try {
        console.log(`Sending POST request to ${API_URL}/nft/mint`);
        const walletAddress = localStorage.getItem('wallet_address');
        const response = await axios.post(
          `${API_URL}/nft/mint`,
          {
            token_id: tokenId,
            chain_id: chainId,
            transaction_hash: transactionHash,
            contract_address: contractAddress,
            metadata_uri: metadataUri
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'x-wallet-address': walletAddress || ''
            },
            // Set a short timeout to avoid long waits if server is down
            timeout: 5000 // Increased timeout for better reliability
          }
        );
        console.log('Successfully recorded mint in backend', response.data);
        return true;
      } catch (apiError: any) {
        console.warn('Error recording mint in backend:');
        if (apiError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.warn('Response error:', {
            status: apiError.response.status,
            data: apiError.response.data,
            headers: apiError.response.headers
          });
        } else if (apiError.request) {
          // The request was made but no response was received
          console.warn('No response received:', apiError.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.warn('Request setup error:', apiError.message);
        }
        // Don't show an error toast to the user - the mint was successful on-chain
        return true;
      }
    } catch (error) {
      console.error('Error in recordMint flow:', error);
      // Don't show error toast since the mint was successful on-chain
      return true; // Return success anyway
    }
  },

  // Get NFT stats
  async getNFTStats(): Promise<{ total_mints: number; unique_owners: number }> {
    try {
      const response = await axios.get(`${API_URL}/nft/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching NFT stats:', error);
      return { total_mints: 0, unique_owners: 0 };
    }
  }
};

export default galleryService;
