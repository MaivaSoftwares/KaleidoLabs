import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import galleryService, { NFT } from '@/services/gallery';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/sonner';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';
// Using direct navigation instead of router

export default function NFTGallery() {
  const { isConnected, address } = useAccount();
  const [authInProgress, setAuthInProgress] = useState(false);

  // Initialize authentication state and listen for wallet address changes
  useEffect(() => {
    // When wallet connects, trigger authentication
    if (isConnected && address) {
      // Clear any existing auth in progress flag
      localStorage.removeItem('auth_in_progress');
      setAuthInProgress(false);
    }
  }, [isConnected, address]);

  // Use React Query to fetch NFTs with network-first, cache-fallback strategy
  const { 
    data: nfts = [] as NFT[], 
    isLoading: loading,
    error,
    refetch
  } = useQuery({
    queryKey: ['userNFTs', address],
    queryFn: async (): Promise<NFT[]> => {
      if (!isConnected) {
        return [];
      }
      return galleryService.getUserNFTs(address);
    },
    enabled: isConnected, // Only run the query when wallet is connected
    staleTime: 0, // Always consider data stale to ensure fresh fetch
    refetchOnMount: 'always', // Always refetch when the component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid disrupting the user
    retry: 3, // Increase retries
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
    // Initialize with cached data if available
    placeholderData: () => {
      const cachedData = galleryService.getCachedNFTs();
      return cachedData || [];
    },
  });
  
  // Handle errors from the query
  useEffect(() => {
    if (error) {
      console.error('Error loading NFTs:', error);
      toast.error('Failed to load your NFTs');
    }
  }, [error]);
  
  // Log when query is enabled/disabled
  useEffect(() => {
    console.log('NFT query status:', { 
      isConnected, 
      queryEnabled: isConnected && !authInProgress
    });
  }, [isConnected, authInProgress]);
  
  // Listen for mint events to refresh the gallery
  useEffect(() => {
    const handleMintSuccess = () => {
      console.log('Mint success event detected, refreshing NFT gallery...');
      // Force an immediate refetch
      refetch();
      
      // Store a flag in localStorage to indicate a refresh is needed
      localStorage.setItem('nft_gallery_needs_refresh', 'true');
    };
    
    // Listen for the custom mint success event
    window.addEventListener('mint_success', handleMintSuccess);
    
    return () => {
      window.removeEventListener('mint_success', handleMintSuccess);
    };
  }, [refetch]);
  
  // Check if we need to refresh on mount (e.g., after navigation)
  useEffect(() => {
    const needsRefresh = localStorage.getItem('nft_gallery_needs_refresh') === 'true';
    
    if (needsRefresh && !authInProgress) {
      console.log('Gallery detected it needs a refresh after navigation');
      refetch();
      // Clear the flag after refreshing
      localStorage.removeItem('nft_gallery_needs_refresh');
    }
  }, [refetch, authInProgress]);

  if (!isConnected) {
    return (
      <div className="text-center p-12 border rounded-lg bg-zinc-800/50 border-emerald-500/20">
        <h3 className="text-xl font-semibold mb-2 text-emerald-400">Connect Your Wallet</h3>
        <p className="text-gray-400 mb-6">Please connect your wallet to view your NFT collection.</p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 rounded-xl text-lg font-medium shadow-lg shadow-emerald-500/20 transition"
        >
          Return to Home
        </button>
      </div>
    );
  }
  
  if (isConnected && authInProgress) {
    return (
      <div className="text-center p-12 border rounded-lg bg-zinc-800/50 border-emerald-500/20">
        <div className="flex justify-center mb-4">
          <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2 text-emerald-400">Authenticating...</h3>
        <p className="text-gray-400 mb-6">Please wait while we complete the authentication process.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-emerald-400">Your Collection</h2>
        <Badge variant="outline" className="px-3 py-1 text-sm bg-zinc-800/50 text-emerald-400 border-emerald-500/30">
          {nfts.length} Nodes
        </Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-zinc-800/50 border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <Skeleton className="h-64 w-full bg-zinc-700/50" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2 bg-zinc-700/50" />
                <Skeleton className="h-4 w-1/2 bg-zinc-700/50" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2 bg-zinc-700/50" />
                <Skeleton className="h-4 w-2/3 bg-zinc-700/50" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center p-12 border rounded-lg bg-zinc-800/50 border-emerald-500/20">
          <h3 className="text-xl font-semibold mb-2 text-emerald-400">No NFTs Found</h3>
          <p className="text-gray-400 mb-6">You haven't minted any NFTs yet.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 rounded-xl text-lg font-medium shadow-lg shadow-emerald-500/20 transition"
          >
            Mint Your First NFT
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nfts.map((nft) => (
            <Card key={nft.id} className="overflow-hidden hover:shadow-lg transition bg-zinc-800/50 border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <div className="relative aspect-square overflow-hidden bg-zinc-900/80">
                {nft.metadata?.image ? (
                  <img
                    src={nft.metadata.image}
                    alt={nft.metadata.name || `NFT #${nft.token_id}`}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400">Image not available</p>
                  </div>
                )}
              </div>
              <CardHeader className="border-b border-emerald-500/10">
                <CardTitle className="text-emerald-400">{nft.metadata?.name || `SuperNode #${nft.token_id}`}</CardTitle>
                <CardDescription className="text-gray-400">
                  Token ID: {nft.token_id}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-400 mb-4">
                  {nft.metadata?.description || 'A powerful SuperNode in the Kaleido network with unique capabilities and attributes.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {nft.metadata?.attributes?.map((attr, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      {attr.trait_type}: {attr.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between text-xs text-gray-400 border-t border-emerald-500/10 pt-4">
                <span>Chain ID: {nft.chain_id}</span>
                <div className="flex gap-2">
                  {nft.transaction_hash && nft.transaction_hash.startsWith('0x') ? (
                    <a
                      href={`https://abscan.org/tx/${nft.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View Transaction
                    </a>
                  ) : (
                    <a
                      href={`https://abscan.org/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View Wallet
                    </a>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
