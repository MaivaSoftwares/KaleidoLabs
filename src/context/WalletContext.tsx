
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from "@/components/ui/sonner";

interface WalletContextType {
  address: string | null;
  connecting: boolean;
  connected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(false);

  // Check if wallet was previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem('nftWalletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
      setConnected(true);
    }
  }, []);

  // Simulating Abstract Global Wallet connect
  const connectWallet = async () => {
    try {
      setConnecting(true);
      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Generate random wallet address
      const mockAddress = `0x${Array.from({ length: 40 }, () => 
        '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
      ).join('')}`;
      
      setAddress(mockAddress);
      setConnected(true);
      localStorage.setItem('nftWalletAddress', mockAddress);
      toast("Wallet connected successfully!", {
        description: `Connected with address ${mockAddress.slice(0, 6)}...${mockAddress.slice(-4)}`
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast("Failed to connect wallet", {
        description: "Please try again later"
      });
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setConnected(false);
    localStorage.removeItem('nftWalletAddress');
    toast("Wallet disconnected");
  };

  return (
    <WalletContext.Provider value={{ 
      address, 
      connecting, 
      connected, 
      connectWallet, 
      disconnectWallet 
    }}>
      {children}
    </WalletContext.Provider>
  );
};
