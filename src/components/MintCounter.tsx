import { useState, useEffect } from 'react';
import { useAccount, useConfig } from 'wagmi';
import { nftService } from '@/services/nft';
import { ethers } from 'ethers';
import { formatNumberWithSuffix } from '@/utils/numberFormat';

export default function MintCounter() {
  const { chainId, isConnected } = useAccount();
  const config = useConfig();
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSupply = async () => {
      try {
        setIsLoading(true);
        
        // Try to get the total supply using the wallet connection if available
        if (isConnected && chainId && config) {
          try {
            const details = await nftService.getCollectionDetails(config, chainId);
            setTotalSupply(details.currentMintCount);
            return;
          } catch (walletError) {
            console.warn("Error loading NFT supply via wallet:", walletError);
            // Fall back to direct provider method if wallet method fails
          }
        }
        
        // If wallet is not connected or wallet method failed, use direct provider
        const contractAddress = "0xe00F447ae98Ff4F1C439f477Cd35630A5145733B";
        const abstractChainId = 2741;
        
        // Simple ABI for just the totalSupply function
        const abi = ["function totalSupply() view returns (uint256)"];
        
        // Connect to Abstract Chain directly - compatible with ethers v5
        const provider = new ethers.providers.JsonRpcProvider("https://api.mainnet.abs.xyz");
        const contract = new ethers.Contract(contractAddress, abi, provider);
        
        // Get total supply directly
        const supply = await contract.totalSupply();
        const formattedSupply = Number(supply);
        setTotalSupply(formattedSupply);
        console.log("Loaded total supply without wallet:", formattedSupply);
      } catch (error) {
        console.error("Error loading NFT supply:", error);
        // Keep the default value if there's an error
      } finally {
        setIsLoading(false);
      }
    };

    loadSupply();

    // Set up polling to refresh the count every 30 seconds
    const interval = setInterval(loadSupply, 30000);
    
    return () => clearInterval(interval);
  }, [chainId, config, isConnected]);

  if (isLoading) {
    return (
      <div className="inline-flex items-center">
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading...</span>
      </div>
    );
  }

  return <>{formatNumberWithSuffix(totalSupply)}</>;
}
