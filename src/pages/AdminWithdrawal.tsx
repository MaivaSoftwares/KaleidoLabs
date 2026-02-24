import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { adminService } from '@/services/admin';
import { authService } from '@/services/auth';
import { useNavigate } from 'react-router-dom';
import { NFTTransfer } from '@/components/NFTTransfer';
import { TwoFactorAuth } from '@/components/TwoFactorAuth';
import { twoFactorService } from '@/services/twoFactor';

const AdminWithdrawal = () => {
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [contractBalance, setContractBalance] = useState<string>('0');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [contractOwner, setContractOwner] = useState<string>('');
  const [privateKey, setPrivateKey] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [is2FAVerified, setIs2FAVerified] = useState<boolean>(false);

  // Check if user is admin and get contract balance
  useEffect(() => {
    const checkAdminAndBalance = async () => {
      if (!isConnected || !address) {
        console.log('No wallet connection or address:', { isConnected, address });
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      if (!isAdmin) {
        setIsLoading(true);
        
        try {
          const authResponse = await adminService.adminAuth(address);
          
          if (!authResponse.success) {
            toast({
              title: "Access Denied",
              description: authResponse.message || "You do not have admin privileges to access this page.",
              variant: "destructive"
            });
            setIsAdmin(false);
            setIsLoading(false);
            return;
          }

          if (authResponse.adminToken) {
            localStorage.setItem('admin_token', authResponse.adminToken);
            authService.setAdminStatus(true);
            
            const balanceResponse = await adminService.getContractBalance();
            
            if (balanceResponse.success) {
              setContractBalance(balanceResponse.balance);
              setContractAddress(balanceResponse.contractAddress);
              setContractOwner(balanceResponse.owner);
              setIsAdmin(true);
              setIsLoading(false);
            } else {
              toast({
                title: "Error",
                description: "Failed to get contract balance. Please try again.",
                variant: "destructive"
              });
              setIsLoading(false);
            }
          } else {
            console.error('No admin token received:', authResponse);
            toast({
              title: "Authentication Error",
              description: "Failed to get admin token. Please try again.",
              variant: "destructive"
            });
            setIsAdmin(false);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error in admin check:', error);
          toast({
            title: "Error",
            description: "Failed to authenticate. Please try again.",
            variant: "destructive"
          });
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    };

    checkAdminAndBalance();
  }, [address, isConnected, navigate, toast]);

  // Verify 2FA when admin is authenticated
  useEffect(() => {
    if (isAdmin && !is2FAVerified) {
      twoFactorService.isTwoFactorEnabled().then(enabled => {
        if (enabled) {
          toast({
            title: "2FA Required",
            description: "Please verify your identity using 2FA",
          });
        }
      });
    }
  }, [isAdmin, is2FAVerified]);

  const refreshBalance = async () => {
    setIsLoading(true);
    
    try {
      const balanceResponse = await adminService.getContractBalance();
      
      if (balanceResponse.success) {
        setContractBalance(balanceResponse.balance);
        setContractAddress(balanceResponse.contractAddress);
        setContractOwner(balanceResponse.owner);
        
        toast({
          title: "Balance Updated",
          description: `Current contract balance: ${balanceResponse.balance} ETH`,
        });
      } else {
        setError(balanceResponse.message || 'Failed to refresh contract balance');
        
        toast({
          title: "Error",
          description: balanceResponse.message || 'Failed to refresh contract balance',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!privateKey || privateKey.length < 64) {
      toast({
        title: "Invalid Private Key",
        description: "Please enter a valid private key for the contract owner.",
        variant: "destructive"
      });
      return;
    }
    
    setIsWithdrawing(true);
    setError('');
    setTxHash('');
    
    try {
      const withdrawalResponse = await adminService.withdrawFunds(privateKey);
      
      if (withdrawalResponse.success) {
        setTxHash(withdrawalResponse.transactionHash || '');
        setPrivateKey(''); // Clear private key for security
        
        toast({
          title: "Withdrawal Initiated",
          description: "Funds withdrawal transaction has been submitted to the blockchain.",
        });
        
        setTimeout(refreshBalance, 5000);
      } else {
        setError(withdrawalResponse.message || 'Failed to withdraw funds');
        
        toast({
          title: "Withdrawal Failed",
          description: withdrawalResponse.message || 'Failed to withdraw funds',
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !isAdmin ? (
        <div className="flex justify-center items-center h-64">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You do not have admin privileges to access this page.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-6">
          <TwoFactorAuth onVerify={() => setIs2FAVerified(true)} />
          
          {!is2FAVerified && (
            <Alert variant="default">
              <AlertTitle>2FA Required</AlertTitle>
              <AlertDescription>
                Please verify your identity using 2FA before proceeding.
              </AlertDescription>
            </Alert>
          )}

          {is2FAVerified && (
            <>
              <NFTTransfer chainId={1} />
              
              <Card>
                <CardHeader>
                  <CardTitle>Contract Balance</CardTitle>
                  <CardDescription>Current balance in the NFT contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-semibold">Balance:</span>
                      <span className="text-2xl font-bold">{contractBalance} ETH</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Contract Address:</span>
                      <span className="text-sm opacity-70">{contractAddress}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Contract Owner:</span>
                      <span className="text-sm opacity-70">{contractOwner}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>Withdraw funds from the NFT contract</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <Input
                        type="password"
                        placeholder="Enter your private key"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <Button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !privateKey}
                      className="w-full"
                    >
                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw Funds'}
                    </Button>
                  </div>
                </CardContent>
                <CardFooter>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Note: This action will withdraw all funds from the contract
                    </span>
                    {txHash && (
                      <a
                        href={`https://monadscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                      >
                        View Transaction
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminWithdrawal;
