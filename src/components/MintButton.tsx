import { useState, useEffect } from 'react';
import { useAccount, useConfig, useWalletClient } from 'wagmi';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { nftService } from '@/services/nft';
import galleryService from '@/services/gallery';
import { Loader2 } from "lucide-react";
// Using direct navigation instead of router

interface MintButtonProps {
  onSuccess?: (tokenId: number) => void;
}

export default function MintButton({ onSuccess }: MintButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const { data: walletClient } = useWalletClient();
  // No router in Vite project
  
  const [isLoading, setIsLoading] = useState(false);
  const [isMintInfoLoading, setIsMintInfoLoading] = useState(true);
  const [mintInfo, setMintInfo] = useState<{
    canMint: boolean;
    remainingMints: number;
    mintCount: number;
    maxMintPerWallet: number;
    totalSupply: number;
    maxSupply: number;
    mintPrice: number;
    paused: boolean;
  }>({
    canMint: false,
    remainingMints: 0,
    mintCount: 0,
    maxMintPerWallet: 0,
    totalSupply: 0,
    maxSupply: 0,
    mintPrice: 0.00043370,
    paused: false
  });

  // Load mint information when wallet is connected
  useEffect(() => {
    const loadMintInfo = async () => {
      if (isConnected && address && chainId) {
        try {
          setIsMintInfoLoading(true);
          
          // Get collection details with user mint count
          const details = await nftService.getCollectionDetails(config, chainId, address);
          
          // Check if user can mint using the details we already have
          const canMintInfo = {
            canMint: !details.paused && details.userMintCount < details.maxMintPerWallet,
            remainingMints: details.maxMintPerWallet - details.userMintCount
          };
          
          // Combine the information
          setMintInfo({
            canMint: canMintInfo.canMint,
            remainingMints: canMintInfo.remainingMints,
            mintCount: details.currentMintCount,
            maxMintPerWallet: details.maxMintPerWallet,
            totalSupply: details.currentMintCount,
            maxSupply: details.maxSupply,
            mintPrice: details.mintPrice,
            paused: details.paused
          });
        } catch (error) {
          console.error("Error loading mint info:", error);
        } finally {
          setIsMintInfoLoading(false);
        }
      } else {
        // Reset loading state if wallet is disconnected
        setIsMintInfoLoading(false);
      }
    };

    loadMintInfo();
  }, [isConnected, address, chainId, config]);

  // Handle mint action
  const handleMint = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!chainId) {
      toast.error("No blockchain connected");
      return;
    }
    
    if (mintInfo.paused) {
      toast.error("Minting is currently paused");
      return;
    }

    if (!mintInfo.canMint) {
      if (mintInfo.remainingMints <= 0) {
        toast.error("Mint limit reached for this wallet");
      } else if (mintInfo.totalSupply >= mintInfo.maxSupply) {
        toast.error("Collection is sold out");
      } else {
        toast.error("Cannot mint at this time");
      }
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('Starting mint process...');
      // Check if wallet is connected and we have a wallet client
      if (!walletClient) {
        throw new Error("No wallet client available. Please connect your wallet.");
      }
      
      // Pass the wallet client configuration to mintNFT
      const result = await nftService.mintNFT({
        ...config,
        walletClient
      }, chainId, address);
      console.log('Mint result:', result);
      
      if (result.success && result.tokenId) {
        console.log('Mint successful, proceeding to record mint');
        console.log('Result details:', result);
        console.log('Current address:', address);
        
        // Ensure we have a valid transaction hash
        const txHash = result.transactionHash;
        console.log('Transaction hash from result:', txHash);
        
        // Add detailed logging for transaction hash
        if (txHash) {
          console.log('Transaction hash is present:', txHash);
          console.log('Transaction hash starts with 0x:', txHash.startsWith('0x'));
          console.log('Transaction hash length:', txHash.length);
        } else {
          console.warn('Transaction hash is missing from result');
        }
        
        // Record the mint in our database
        if (txHash && txHash.startsWith('0x') && address) {
          console.log('Recording mint with params:', {
            tokenId: result.tokenId.toString(),
            chainId,
            transactionHash: txHash,
            contractAddress: nftService.getContractAddress(chainId)
          });
          
          try {
            // Get the token URI from the contract
            const tokenUri = await nftService.getContract(config, chainId).publicClient.readContract({
              address: nftService.getContractAddress(chainId),
              abi: nftService.getContract(config, chainId).abi,
              functionName: 'tokenURI',
              args: [result.tokenId]
            });

            const recordResult = await galleryService.recordMint(
              result.tokenId.toString(),
              chainId,
              result.transactionHash,
              nftService.getContractAddress(chainId),
              tokenUri
            );
            console.log('Record mint result:', recordResult);
            
            // Show success message with view gallery option
            toast.success(
              "NFT minted successfully!", 
              {
                description: `Your NFT has been minted successfully. Token ID: #${result.tokenId}`,
                action: {
                  label: "View Gallery",
                  onClick: () => window.location.href = '/gallery'
                }
              }
            );
          } catch (recordError) {
            console.error('Error recording mint:', recordError);
            // Show success message with view gallery option
            toast.success(
              "NFT minted successfully!", 
              {
                description: `Your NFT has been minted successfully. Token ID: #${result.tokenId}`,
                action: {
                  label: "View Gallery",
                  onClick: () => window.location.href = '/gallery'
                }
              }
            );
          }
        } else {
          console.warn('Missing transaction hash or address, cannot record mint');
          console.warn('Transaction hash present:', !!result.transactionHash);
          console.warn('Address present:', !!address);
          
          // Try to record mint anyway with fallback values
          if (result.tokenId) {
            try {
              console.log('Attempting to record mint with fallback values');
              // Use a fallback transaction hash if needed
              const fallbackTxHash = result.transactionHash || `fallback-${Date.now()}-${result.tokenId}`;
              
              // Get the token URI from the contract
              const tokenUri = await nftService.getContract(config, chainId).publicClient.readContract({
                address: nftService.getContractAddress(chainId),
                abi: nftService.getContract(config, chainId).abi,
                functionName: 'tokenURI',
                args: [result.tokenId]
              });

              const recordResult = await galleryService.recordMint(
                result.tokenId.toString(),
                chainId,
                fallbackTxHash,
                nftService.getContractAddress(chainId),
                tokenUri
              );
              console.log('Fallback record mint result:', recordResult);
            } catch (fallbackError) {
              console.error('Error with fallback recording:', fallbackError);
            }
          }
        }
        
        if (onSuccess) {
          onSuccess(result.tokenId);
        }
        
        // Dispatch a custom event to notify the gallery to refresh
        window.dispatchEvent(new Event('mint_success'));
      }
      
      // Refresh mint info after successful mint
      const details = await nftService.getCollectionDetails(config, chainId);
      const canMintInfo = await nftService.canMint(config, chainId, address);
      
      setMintInfo({
        canMint: canMintInfo.canMint,
        remainingMints: canMintInfo.remainingMints,
        mintCount: details.currentMintCount,
        maxMintPerWallet: details.maxMintPerWallet,
        totalSupply: details.maxSupply, // Use maxSupply instead of currentMintCount
        maxSupply: details.maxSupply,
        mintPrice: details.mintPrice,
        paused: details.paused
      });
      
    } catch (error) {
      console.error("Mint error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine button state
  const getButtonText = () => {
    if (!isConnected) return "CONNECT WALLET TO MINT";
    if (mintInfo.paused) return "MINTING PAUSED";
    if (mintInfo.totalSupply >= mintInfo.maxSupply) return "SOLD OUT";
    if (mintInfo.remainingMints <= 0) return "MINT LIMIT REACHED";
    return `MINT NOW (${mintInfo.mintPrice} ETH)`;
  };
  
  // Determine if button should be disabled
  const isDisabled = !isConnected || isMintInfoLoading || !mintInfo.canMint || isLoading || mintInfo.paused || mintInfo.remainingMints <= 0;
  
  // Get button tooltip text
  const getTooltipText = () => {
    if (!isConnected) return "Connect your wallet to mint";
    if (mintInfo.paused) return "Minting is currently paused";
    if (mintInfo.totalSupply >= mintInfo.maxSupply) return "Please wait, while loading!";
    if (mintInfo.remainingMints <= 0) return `You have already minted ${mintInfo.maxMintPerWallet} NFTs (maximum allowed per wallet)`;
    return `You can mint up to ${mintInfo.remainingMints} more NFTs (maximum ${mintInfo.maxMintPerWallet} per wallet)`;
  };

  return (
    <div className="relative group">
      <Button
        onClick={handleMint}
        disabled={isDisabled}
        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed py-6 text-lg font-medium"
      >
        {isLoading ? (
          <span className="flex items-center justify-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Minting...
          </span>
        ) : (
          <span>
            {!isConnected ? "Connect Wallet" : 
             isMintInfoLoading ? "Loading..." : 
             mintInfo.remainingMints <= 0 ? "Mint Limit Reached" : "Mint Node"}
          </span>
        )}
      </Button>
      
      {/* Tooltip that appears on hover when button is disabled */}
      {isDisabled && getTooltipText() && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
          {getTooltipText()}
        </div>
      )}
    </div>
  );
}
