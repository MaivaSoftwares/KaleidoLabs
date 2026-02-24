import { ethers } from 'ethers';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseEther } from '@ethersproject/units';
import { toast } from '@/components/ui/sonner';
import { writeContract } from 'viem/actions';
import axios from 'axios';
import { galleryService } from '@/services/gallery';

// Use the same approach as auth.ts for consistency
const API_URL = import.meta.env.VITE_API_URL || '/api';

// ABI for the KaleidoSuperNode contract
const contractABI = [
  // View functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function maxMintPerWallet() view returns (uint256)",
  "function mintedPerWallet(address) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function mintPrice() view returns (uint256)",
  "function paused() view returns (bool)",
  
  // Mint function
  "function mint(uint256 _mintAmount) payable"
];

// Contract addresses for different networks
const contractAddresses: Record<number, `0x${string}`> = {
  // Abstract Chain
  2741: "0xe00F447ae98Ff4F1C439f477Cd35630A5145733B",
  
  // Monad Testnet
  10143: "0x0000000000000000000000000000000000000000"
};

export const nftService = {
  /**
   * Check if a user can mint NFTs
   * @param config Wagmi config
   * @param chainId Chain ID
   * @param address User wallet address
   * @returns Object with canMint boolean and reason if cannot mint
   */
  async canMint(config: any, chainId: number, address: string) {
    try {
      const details = await this.getCollectionDetails(config, chainId, address);
      const userMintCount = details.userMintCount;
      
      if (details.paused) {
        return {
          canMint: false,
          reason: 'Minting is currently paused'
        };
      }

      if (userMintCount >= details.maxMintPerWallet) {
        return {
          canMint: false,
          reason: `You have reached your maximum mint limit of ${details.maxMintPerWallet} NFTs`
        };
      }

      return {
        canMint: true,
        remainingMints: details.maxMintPerWallet - userMintCount
      };
    } catch (error) {
      console.error('Error checking mint eligibility:', error);
      return {
        canMint: false,
        reason: 'Error checking mint eligibility'
      };
    }
  },
  /**
  /**
   * Transfer an NFT to another wallet
   * @param config Wagmi config
   * @param chainId Chain ID
   * @param tokenId Token ID to transfer
   * @param recipientAddress Recipient's wallet address
   * @returns Promise<boolean>
   */
  async transferNft(config: any, chainId: number, tokenId: number, recipientAddress: string, senderAddress: string) {
    try {
      // Get the contract address
      const contractAddress = this.getContractAddress(chainId);
      
      // Get the public client from wagmi config
      const { publicClient } = config;
      if (!publicClient) {
        throw new Error('No public client available. Please connect your wallet.');
      }

      // Get the wallet client from wagmi config
      const { walletClient } = config;
      if (!walletClient) {
        throw new Error('No wallet client available. Please connect your wallet.');
      }

      console.log('Transfer parameters:', {
        contractAddress,
        tokenId,
        recipientAddress,
        senderAddress,
        chainId,
        walletClient: walletClient?.account
      });

      // Update ABI to use proper JSON format
      const formattedABI = [
        {
          "type": "function",
          "name": "name",
          "stateMutability": "view",
          "outputs": [{ "type": "string" }]
        },
        {
          "type": "function",
          "name": "symbol",
          "stateMutability": "view",
          "outputs": [{ "type": "string" }]
        },
        {
          "type": "function",
          "name": "totalSupply",
          "stateMutability": "view",
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "maxSupply",
          "stateMutability": "view",
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "maxMintPerWallet",
          "stateMutability": "view",
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "mintedPerWallet",
          "stateMutability": "view",
          "inputs": [{ "type": "address" }],
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "tokenURI",
          "stateMutability": "view",
          "inputs": [{ "type": "uint256", "name": "tokenId" }],
          "outputs": [{ "type": "string" }]
        },
        {
          "type": "function",
          "name": "ownerOf",
          "stateMutability": "view",
          "inputs": [{ "type": "uint256", "name": "tokenId" }],
          "outputs": [{ "type": "address" }]
        },
        {
          "type": "function",
          "name": "balanceOf",
          "stateMutability": "view",
          "inputs": [{ "type": "address", "name": "owner" }],
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "mintPrice",
          "stateMutability": "view",
          "outputs": [{ "type": "uint256" }]
        },
        {
          "type": "function",
          "name": "paused",
          "stateMutability": "view",
          "outputs": [{ "type": "bool" }]
        },
        {
          "type": "function",
          "name": "safeTransferFrom",
          "inputs": [
            { "type": "address", "name": "from" },
            { "type": "address", "name": "to" },
            { "type": "uint256", "name": "tokenId" }
          ]
        }
      ];

      // Create the transaction
      const tx = await writeContract(
        walletClient,
        {
          address: contractAddress,
          abi: formattedABI,
          functionName: 'safeTransferFrom',
          args: [
            senderAddress,
            recipientAddress,
            tokenId
          ],
          chain: walletClient.chain,
          account: walletClient?.account
        }
      );

      // Wait for transaction to be confirmed
      await publicClient.waitForTransactionReceipt({
        hash: tx
      });

      // Update ownership in database
      try {
        await axios.post(`${API_URL}/nft/update-ownership`, {
          tokenId,
          newOwnerAddress: recipientAddress
        }, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error updating ownership in database:', error);
        // Don't fail the transfer if database update fails
      }

      return {
        success: true,
        message: `Successfully transferred NFT #${tokenId} to ${recipientAddress}`
      };
    } catch (error) {
      console.error('Error transferring NFT:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to transfer NFT. Please try again.'
      };
    }
  },

  /**
   * Get the contract address for a specific chain
   */
  getContractAddress(chainId: number): string {
    return contractAddresses[chainId as keyof typeof contractAddresses] || "0x0000000000000000000000000000000000000000";
  },

  /**
   * Get the contract instance for the current network
   */
  getContract(config: any, chainId: number) {
    const address = contractAddresses[chainId as keyof typeof contractAddresses];
    
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Contract not deployed on chain ID ${chainId}`);
    }
    
    // Handle different Wagmi versions
    let publicClient, walletClient;
    
    // Check which method is available
    if (typeof config.getPublicClient === 'function') {
      // Wagmi v2
      publicClient = config.getPublicClient({ chainId });
      walletClient = config.getWalletClient({ chainId });
    } else if (config.publicClient) {
      // Direct access
      publicClient = config.publicClient;
      walletClient = config.walletClient;
    } else {
      // Fallback
      publicClient = config;
      walletClient = config;
    }
    
    return {
      address,
      abi: contractABI,
      publicClient,
      walletClient
    };
  },

  /**
   * Get the provider for a specific chain
   */
  getProvider(config: any, chainId: number) {
    // Handle different Wagmi versions
    let provider;
    
    // Check which method is available
    if (typeof config.getProvider === 'function') {
      // Wagmi v2
      provider = config.getProvider({ chainId });
    } else if (config.provider) {
      // Direct access
      provider = config.provider;
    } else {
      // Fallback
      provider = config;
    }
    
    return provider;
  },

  /**
   * Get the number of NFTs owned by a user
   * @param config Wagmi config
   * @param chainId Chain ID
   * @param address User wallet address
   * @returns Number of NFTs owned
   */
  async getUserNftCount(config: any, chainId: number, address: string) {
    try {
      // Use the same approach as in getCollectionDetails
      const contractAddress = this.getContractAddress(chainId);
      
      // Use direct ethers.js approach with JsonRpcProvider
      const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
        ? 'https://api.mainnet.abs.xyz' 
        : 'https://rpc-testnet.monad.xyz');
      
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      console.log('Connected to contract via ethers.js for NFT count');
      
      // Use balanceOf to get the number of NFTs owned by the user
      const balance = await contract.balanceOf(address);
      return parseInt(balance.toString());
    } catch (error) {
      console.error('Error getting user NFT count:', error);
      return 0;
    }
  },

  /**
   * Get NFT collection details
   * @param config Wagmi config
   * @param chainId Chain ID
   * @param address Optional user address to get mint count for
   * @returns Collection details including optional user mint count
   */
  async getCollectionDetails(config: any, chainId: number, address?: string) {
    try {
      const { publicClient, address: contractAddress, abi } = this.getContract(config, chainId);
      
      // Get current mint count (number of NFTs minted so far)
      let currentMintCount = 0;
      try {
        // Try direct ethers.js approach
        try {
          const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
            ? 'https://api.mainnet.abs.xyz' 
            : 'https://rpc-testnet.monad.xyz');
          
          const contract = new ethers.Contract(contractAddress, contractABI, provider);
          
          const ethersResult = await contract.totalSupply();
          currentMintCount = Number(ethersResult);
        } catch (ethersError) {
          // Fall back to backend
          try {
            const response = await fetch('/api/nft/stats');
            if (response.ok) {
              const data = await response.json();
              currentMintCount = data.total_mints || 0;
            }
          } catch (backendError) {
            // Ignore backend error
          }
        }
      } catch (error) {
        // Ignore mint count error
      }

      // Total supply is unlimited
      const totalSupply = Number.MAX_SAFE_INTEGER;
      
      // Get user's mint count if address is provided
      let userMintCount: number = 0;
      if (address) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
            ? 'https://api.mainnet.abs.xyz' 
            : 'https://rpc-testnet.monad.xyz');
          
          const contract = new ethers.Contract(contractAddress, contractABI, provider);
          const result = await contract.mintedPerWallet(address);
          userMintCount = Number(result);
          console.log('User mint count:', userMintCount);
        } catch (error) {
          console.error('Error getting user mint count:', error);
        }
      }

      // Get contract values with proper error handling
      let maxMintPerWallet: bigint = 10n; // Default value
      let mintPrice: bigint = 0n; // Default value
      let paused: boolean = false; // Default value
      
      // Get maxMintPerWallet from the contract
      try {
        const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
          ? 'https://api.mainnet.abs.xyz' 
          : 'https://rpc-testnet.monad.xyz');
        
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        const result = await contract.maxMintPerWallet();
        maxMintPerWallet = BigInt(result);
      } catch (error) {
        // Ignore max mint per wallet error
      }
      
      // Get mintPrice from the contract
      try {
        const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
          ? 'https://api.mainnet.abs.xyz' 
          : 'https://rpc-testnet.monad.xyz');
        
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        const result = await contract.mintPrice();
        mintPrice = BigInt(result);
      } catch (error) {
        // Ignore mint price error
      }
      
      // Get paused status from the contract
      try {
        const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
          ? 'https://api.mainnet.abs.xyz' 
          : 'https://rpc-testnet.monad.xyz');
        
        const contract = new ethers.Contract(contractAddress, contractABI, provider);
        const result = await contract.paused();
        paused = Boolean(result);
      } catch (error) {
        // Ignore paused status error
      }
      
      return {
        name: 'Kaleido SuperNode',
        symbol: 'KSNODE',
        currentMintCount: currentMintCount,
        maxSupply: Number.MAX_SAFE_INTEGER, // Unlimited
        maxMintPerWallet: Number(maxMintPerWallet),
        mintPrice: Number(mintPrice) / 1e18, // Convert from wei to ETH
        paused: Boolean(paused),
        userMintCount: userMintCount
      };
    } catch (error) {
      console.error("Error getting collection details:", error);
      return {
        name: 'Kaleido SuperNode XVD26F',
        symbol: 'KSNODE',
        currentMintCount: 0,
        maxSupply: Number.MAX_SAFE_INTEGER,
        maxMintPerWallet: 0, // Default to 0 if we can't get it from contract
        mintPrice: 0,
        paused: true,
        userMintCount: 0
      };
    }
  },

  /**
   * Get user's mint count
   */
    async getUserMintCount(config: any, chainId: number, address: string) {
    try {
      console.log('Starting getUserMintCount for address:', address);
      const contractAddress = this.getContractAddress(chainId);
      
      // Use ethers.js approach which is working
      const provider = new ethers.providers.JsonRpcProvider(chainId === 2741 
        ? 'https://api.mainnet.abs.xyz' 
        : 'https://rpc-testnet.monad.xyz');
      
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      console.log('Connected to contract at address:', contractAddress);
      
      // First try mintedPerWallet mapping
      try {
        console.log('Calling mintedPerWallet mapping for address:', address);
        const result = await contract.mintedPerWallet(address);
        const mintCount = Number(result);
        console.log('User mintedPerWallet count from blockchain:', mintCount);
        // If mintCount is 0 and we haven't minted before, return 0
        if (mintCount === 0) {
          console.log('User has not minted before, returning 0');
          return 0;
        }
        return mintCount;
      } catch (error) {
        console.error('Error calling mintedPerWallet mapping:', error);
        
        // If mintedPerWallet fails, try balanceOf as a fallback
        try {
          console.log('Falling back to balanceOf method');
          const balance = await contract.balanceOf(address);
          const balanceCount = Number(balance);
          console.log('User balance from blockchain:', balanceCount);
          // If balance is 0, user hasn't minted before
          if (balanceCount === 0) {
            console.log('User has no balance, returning 0');
            return 0;
          }
          return balanceCount;
        } catch (error) {
          console.error('Error calling balanceOf function:', error);
          
          // If balanceOf also fails, check the backend
          try {
            console.log('Checking backend for user NFTs');
            const nfts = await fetch('/api/nft/mints').then(res => res.json());
            if (Array.isArray(nfts)) {
              console.log('User NFTs from backend:', nfts.length);
              // If no NFTs in backend, user hasn't minted before
              if (nfts.length === 0) {
                console.log('No NFTs found in backend, returning 0');
                return 0;
              }
              return nfts.length;
            }
          } catch (error) {
            console.error('Error fetching NFTs from backend:', error);
          }
          
          // Only default to 0 if all methods fail
          console.error('All methods failed to get mint count, returning 0');
          return 0;
        }
      }
    } catch (error) {
      console.error("Error getting user mint count:", error);
      // Only default to 0 if the entire process fails
      return 0;
    }
  },

  /**
   * Mint NFTs
   */
  async mintNFT(config: any, chainId: number, address?: string, amount: number = 1) {
    try {
      const { publicClient, address: contractAddress } = this.getContract(config, chainId);
      const walletClient = config.walletClient;
      
      // Get the connected wallet address from wagmi client
      const address = walletClient?.account?.address;
      if (!address) {
        throw new Error("No wallet connected. Please connect your wallet.");
      }

      console.log('Using wallet address for minting:', address);
      
      // Create a signer from the wallet client
      const signer = new ethers.providers.Web3Provider(walletClient).getSigner();
      
      // Create contract instance with signer
      const contract = new ethers.Contract(contractAddress, contractABI, signer);
      
      // Get mint price using the appropriate method based on wallet type
      let mintPriceWei: bigint;
      if (walletClient.chain.id === 2741) {
        // For Abstract, use direct provider
        const provider = new ethers.providers.JsonRpcProvider('https://api.mainnet.abs.xyz');
        const abstractContract = new ethers.Contract(contractAddress, contractABI, provider);
        const mintPrice = await abstractContract.mintPrice();
        mintPriceWei = BigInt(mintPrice);
      } else {
        // For MetaMask and other wallets, use signer
        const mintPrice = await contract.mintPrice();
        mintPriceWei = BigInt(mintPrice);
      }
      
      // Calculate total price
      const totalPrice = mintPriceWei * BigInt(amount);

      // Show toast for transaction preparation
      toast.info("Preparing transaction...", {
        description: `Minting ${amount} Kaleido SuperNode NFT${amount > 1 ? 's' : ''} for ${Number(mintPriceWei) / 1e18 * amount} ETH/MON`
      });

      // Format ABI for viem
      const viemAbi = [
        // Mint function
        {
          type: 'function',
          name: 'mint',
          inputs: [{
            type: 'uint256',
            name: '_mintAmount'
          }],
          outputs: [],
          stateMutability: 'payable'
        }
      ];

      // Create the transaction parameters
      const txParams = {
        to: contractAddress,
        value: mintPriceWei * BigInt(amount),
        data: contract.interface.encodeFunctionData('mint', [amount])
      };

      // Add retry logic with timeout handling
      const retryCount = 3;
      const retryDelay = 2000; // 2 seconds
      const maxDelay = 10000; // 10 seconds

      async function mintWithRetry(attempt = 1): Promise<any> {
        try {
          if (walletClient.chain.id === 2741) {
            // For Abstract, we need to use the wallet client directly
            const tx = await walletClient.sendTransaction({
              ...txParams,
              chain: walletClient.chain,
              account: address
            });
            return tx;
          }

          // For MetaMask and other wallets, use viem's writeContract
          const tx = await writeContract(
            walletClient,
            {
              address: contractAddress,
              abi: viemAbi,
              functionName: 'mint',
              args: [amount],
              value: mintPriceWei * BigInt(amount),
              chain: walletClient.chain,
              account: address
            }
          );
          return tx;
        } catch (error: any) {
          if (attempt >= retryCount) {
            console.error(`Mint failed after ${retryCount} attempts. Last error:`, error);
            throw error;
          }
          
          // Calculate exponential backoff delay
          const delay = Math.min(retryDelay * Math.pow(2, attempt - 1), maxDelay);
          console.log(`Mint attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
          
          // Add toast notification for retries
          toast.warning(`Mint attempt ${attempt} failed. Retrying...`, {
            description: error.message
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          return mintWithRetry(attempt + 1);
        }
      }

      const tx = await mintWithRetry();

      // Show toast for transaction sent
      toast.info("Transaction submitted", {
        description: "Please wait for confirmation"
      });

      // Wait for transaction to be confirmed
      let receipt;
      if (walletClient.chain.id === 2741) {
        // For Abstract, use direct provider
        const provider = new ethers.providers.JsonRpcProvider('https://api.mainnet.abs.xyz');
        receipt = await provider.getTransactionReceipt(tx);
      } else {
        // For MetaMask, use signer's provider
        receipt = await signer.provider.getTransactionReceipt(tx);
      }

      // Check if transaction was successful
      if (receipt.status === 1) {
        // Try to get the token ID from the transaction logs
        let tokenId;
        try {
          // Look for the Transfer event in the transaction logs
          const transferEvent = receipt.logs.find(log => {
            try {
              const parsedLog = new ethers.utils.Interface(contractABI).parseLog(log);
              return parsedLog.name === 'Transfer';
            } catch (e) {
              return false;
            }
          });
          if (transferEvent) {
            // Parse the event to get the token ID
            const parsedLog = new ethers.utils.Interface(contractABI).parseLog(transferEvent);
            tokenId = parsedLog.args.tokenId.toNumber();
            console.log('Found token ID from Transfer event:', tokenId);
          } else {
            // If we can't find the event, use the total supply as an approximation
            console.log('Could not find Transfer event, using fallback method');
            let totalSupply;
            try {
              if (walletClient.chain.id === 2741) {
                // For Abstract, use ethers.js
                const provider = new ethers.providers.JsonRpcProvider('https://api.mainnet.abs.xyz');
                const contract = new ethers.Contract(contractAddress, contractABI, provider);
                totalSupply = await contract.totalSupply();
              } else {
                // For MetaMask, use viem
                totalSupply = await publicClient.readContract({
                  address: contractAddress,
                  abi: viemAbi,
                  functionName: 'totalSupply'
                });
              }
            } catch (error) {
              console.error('Error fetching total supply:', error);
              throw new Error('Failed to fetch total supply');
            }
            tokenId = Number(totalSupply);
            console.log('Using total supply as token ID:', tokenId);
          }

          // Record the mint in our database
          try {
            // For Abstract, use direct provider
            let tokenUri: string = `https://launchpad.kaleidofinance.xyz/api/nft/metadata/${tokenId}`;
            
            // Try to fetch tokenURI, but don't fail if it fails
            try {
              const provider = new ethers.providers.JsonRpcProvider('https://api.mainnet.abs.xyz');
              const contract = new ethers.Contract(contractAddress, contractABI, provider);
              const fetchedUri = await contract.tokenURI(tokenId);
              if (fetchedUri) {
                tokenUri = fetchedUri;
              }
            } catch (error) {
              console.warn('Failed to fetch tokenURI, using default:', error);
            }

            const recordResult = await galleryService.recordMint(
              tokenId.toString(),
              chainId,
              tx,
              nftService.getContractAddress(chainId),
              tokenUri
            );
            console.log('Record mint result:', recordResult);

            return {
              success: true,
              message: `Successfully minted NFT #${tokenId}`,
              tokenId: tokenId,
              transactionHash: tx
            };
          } catch (recordError) {
            console.error('Error recording mint:', recordError);
            // Still return success since the mint was successful on-chain
            return {
              success: true,
              message: `Successfully minted NFT #${tokenId} (database record failed)`,
              tokenId: tokenId,
              transactionHash: tx
            };
          }
        } catch (error) {
          console.error('Error extracting token ID from logs:', error);
          throw error;
        }
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Error minting NFT:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mint NFT. Please try again.',
        tokenId: null,
        transactionHash: null
      };
    }
  }
};
