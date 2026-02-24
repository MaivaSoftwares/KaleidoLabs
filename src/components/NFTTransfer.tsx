import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { nftService } from '@/services/nft';
import { useQueryClient } from '@tanstack/react-query';

interface NFTTransferProps {
  chainId: number;
}

export const NFTTransfer = ({ chainId }: NFTTransferProps) => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTransfer = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive"
      });
      return;
    }

    if (!walletClient) {
      toast({
        title: "Error",
        description: "No wallet client available. Please connect your wallet.",
        variant: "destructive"
      });
      return;
    }

    if (!recipientAddress || !recipientAddress.startsWith('0x')) {
      setError('Please enter a valid recipient address');
      return;
    }

    if (!tokenId) {
      setError('Please enter a token ID');
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      
      // Convert tokenId to number
      const tokenIdNum = parseInt(tokenId);
      if (isNaN(tokenIdNum)) {
        throw new Error('Invalid token ID');
      }

      // Perform the transfer
      const result = await nftService.transferNft(
        { publicClient, walletClient },
        chainId,
        tokenIdNum,
        recipientAddress,
        address
      );
      
      if (result.success) {
        // Invalidate and refetch NFT queries to update the gallery
        queryClient.invalidateQueries({ queryKey: ['userNFTs'] });
        
        toast({
          title: "Success",
          description: result.message
        });
        setRecipientAddress('');
        setTokenId('');
      } else {
        setError(result.message);
        toast({
          title: "Error",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer NFT');
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>NFT Transfer</CardTitle>
        <CardDescription>Transfer your NFTs to another wallet</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Recipient Address</label>
            <Input
              type="text"
              placeholder="0x..."
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Token ID</label>
            <Input
              type="number"
              placeholder="Enter token ID"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button
          onClick={handleTransfer}
          disabled={isLoading || !isConnected}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Transfer NFT
        </Button>
      </CardFooter>
    </Card>
  );
};
