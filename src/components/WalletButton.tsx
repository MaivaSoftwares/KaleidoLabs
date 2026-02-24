import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect } from "react";
import { useAccount } from "wagmi";
import { authService } from "@/services/auth";
import { toast } from "@/components/ui/sonner";

export default function WalletButton() {
  const { address, isConnected } = useAccount();

  // Handle authentication when wallet connects or changes
  useEffect(() => {
    const authenticateUser = async () => {
      if (isConnected && address) {
        try {
          // Check if we're already in the middle of authentication
          const isInProgress = localStorage.getItem('auth_in_progress') === 'true';
          
          if (isInProgress) {
            console.log('Authentication already in progress, skipping');
            return;
          }

          // Check if we already have an auth token in localStorage
          const authToken = localStorage.getItem('auth_token');
          const storedWalletAddress = localStorage.getItem('wallet_address');
          
          // Check if this wallet has previously authenticated
          const hasAuthenticated = await checkPreviousAuthentication(address);
          
          // If wallet has previously authenticated, auto-authenticate without signing
          if (hasAuthenticated) {
            console.log('Wallet previously authenticated, skipping sign message');
            
            // Set a flag to indicate authentication is in progress
            localStorage.setItem('auth_in_progress', 'true');
            
            // Auto-authenticate the user
            authService.setAuthHeader(address);
            
            // Add a small delay to ensure localStorage is updated before other components check it
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Remove the in-progress flag
            localStorage.removeItem('auth_in_progress');
            
            // Dispatch a custom event to notify other components that auth is complete
            window.dispatchEvent(new Event('auth_complete'));
            
            // Silent authentication - no toast needed
            return;
          }
          
          // Authenticate if no token exists or if the wallet address has changed
          if (!authToken || storedWalletAddress !== address) {
            // Set a flag to indicate authentication is in progress
            localStorage.setItem('auth_in_progress', 'true');
            
            // Clear previous auth if wallet changed
            if (storedWalletAddress && storedWalletAddress !== address) {
              localStorage.removeItem('auth_token');
              localStorage.removeItem('wallet_address');
              console.log('Wallet changed, re-authenticating...');
            }
            
            toast.info("Authenticating with wallet...", {
              description: "Please sign the message in your wallet"
            });
            
            // Sign in with the connected wallet
            const result = await authService.signIn(address, {
              signMessage: async (message: string) => {
                // Use the address as the account parameter
                return window.ethereum.request({
                  method: 'eth_sign',
                  params: [address, message]
                });
              }
            });
            
            // Store auth token and wallet address
            if (result.success) {
              localStorage.setItem('auth_token', result.address);
              localStorage.setItem('wallet_address', address);
              
              // Add a small delay to ensure localStorage is updated before other components check it
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Remove the in-progress flag
              localStorage.removeItem('auth_in_progress');
              
              // Dispatch a custom event to notify other components that auth is complete
              window.dispatchEvent(new Event('auth_complete'));
              
              toast.success("Authentication successful");
            }
          } else {
            // Authentication already complete with this wallet
            localStorage.removeItem('auth_in_progress');
            console.log('Already authenticated with this wallet');
          }
        } catch (error) {
          console.error("Authentication error:", error);
          localStorage.removeItem('auth_in_progress');
          toast.error("Authentication failed", {
            description: "Please try connecting your wallet again"
          });
        }
      } else if (!isConnected) {
        // We don't clear authentication when wallet disconnects
        // This allows the same wallet to reconnect without re-authenticating
        console.log('Wallet disconnected, but keeping authentication data for reconnection');
      }
    };
    
    // Check if the wallet has previously authenticated with the server
    const checkPreviousAuthentication = async (walletAddress: string) => {
      try {
        // Check if the wallet exists in the database
        const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/check/${walletAddress}`);
        
        if (response.ok) {
          const data = await response.json();
          return data.exists;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking wallet authentication:', error);
        return false;
      }
    };

    authenticateUser();
  }, [address, isConnected]);

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 rounded-full px-6 py-2 text-sm font-medium shadow-lg shadow-emerald-500/20"
                  >
                    CONNECT WALLET
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="bg-zinc-800 text-white rounded-full px-3 py-1 text-sm font-medium flex items-center gap-1"
                  >
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300 rounded-full px-4 py-1 text-sm font-medium shadow-lg shadow-emerald-500/20"
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
