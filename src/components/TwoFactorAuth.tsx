import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { QrCode } from 'lucide-react';
import { twoFactorService } from '@/services/twoFactor';

interface TwoFactorAuthProps {
  onVerify?: () => void;
}

export const TwoFactorAuth = ({ onVerify }: TwoFactorAuthProps) => {
  const { toast } = useToast();
  const [isSetup, setIsSetup] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSetupLoading, setIsSetupLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    check2FAStatus();
  }, []);

  const check2FAStatus = async () => {
    try {
      const enabled = await twoFactorService.isTwoFactorEnabled();
      setIsSetup(enabled);
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }
  };

  const setup2FA = async () => {
    setIsSetupLoading(true);
    setError('');

    try {
      const response = await twoFactorService.setupTwoFactor();
      
      if (response.success) {
        setQrCodeUrl(response.qrCodeUrl);
        setIsSetup(true);
        toast({
          title: "2FA Setup",
          description: "Scan the QR code with Google Authenticator",
        });
      } else {
        setError(response.message || 'Failed to setup 2FA');
        toast({
          title: "Error",
          description: response.message || "Failed to setup 2FA",
          variant: "destructive"
        });
      }
    } catch (error) {
      setError('Failed to setup 2FA');
      toast({
        title: "Error",
        description: "Failed to setup 2FA",
        variant: "destructive"
      });
    } finally {
      setIsSetupLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code) {
      setError('Please enter the 2FA code');
      return;
    }

    setIsVerifyLoading(true);
    setError('');

    try {
      const response = await twoFactorService.verifyCode(code);
      
      if (response.success) {
        setIsVerified(true);
        toast({
          title: "Success",
          description: "2FA verified successfully",
        });
        
        if (onVerify) {
          onVerify();
        }
      } else {
        setError(response.message || 'Invalid 2FA code');
        toast({
          title: "Error",
          description: response.message || "Invalid 2FA code",
          variant: "destructive"
        });
      }
    } catch (error) {
      setError('Failed to verify 2FA code');
      toast({
        title: "Error",
        description: "Failed to verify 2FA code",
        variant: "destructive"
      });
    } finally {
      setIsVerifyLoading(false);
    }
  };

  if (isVerified) {
    return null; // 2FA verified, no need to show component
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>2FA Authentication</CardTitle>
        <CardDescription>
          Please verify your identity using 2FA
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isSetup ? (
          <Button
            onClick={setup2FA}
            disabled={isSetupLoading}
          >
            {isSetupLoading ? 'Setting up...' : 'Setup 2FA'}
          </Button>
        ) : (
          <div className="space-y-4">
            {qrCodeUrl && (
              <div className="flex items-center justify-center">
                <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            )}
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 2FA code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isVerifyLoading}
              />
              <Button
                onClick={verifyCode}
                disabled={isVerifyLoading || !code}
              >
                {isVerifyLoading ? 'Verifying...' : 'Verify'}
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
