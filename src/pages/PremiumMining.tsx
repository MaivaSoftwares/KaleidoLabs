import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAccount } from 'wagmi';
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";
import { nftService } from "@/services/nft";
import { miningService } from "@/services/mining";
import { useConfig } from "wagmi";
import MintButton from "@/components/MintButton";
import MintCounter from "@/components/MintCounter";

interface MiningState {
  isActive: boolean;
  startTime: number | null;
  cpuCount: number;
  coresPerCpu: number;
  ramPerCpu: number;
  miningRate: number;
  totalPoints: number;
}

const PremiumMining = () => {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  
  // NFT ownership state
  const [ownedNfts, setOwnedNfts] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Mining configuration state
  const [miningState, setMiningState] = useState<MiningState>({
    isActive: false,
    startTime: null,
    cpuCount: 1,
    coresPerCpu: 12, // Fixed at max cores per CPU
    ramPerCpu: 500, // Fixed at max RAM per CPU in GB
    miningRate: 0.0045,
    totalPoints: 0
  });
  
  // Real-time counter
  const [currentPoints, setCurrentPoints] = useState<number>(0);
  const [counterInterval, setCounterInterval] = useState<number | null>(null);
  
  // Total accumulated points
  const [totalPoints, setTotalPoints] = useState<number>(0);
  
  // Loading state for mining actions
  const [isMiningActionLoading, setIsMiningActionLoading] = useState<boolean>(false);
  
  // We'll prioritize database state over localStorage, so we don't need to check localStorage on initial load
  // The database state will be fetched when the wallet connects

  // Fetch user's NFTs and mining stats when wallet is connected
  useEffect(() => {
    const fetchData = async () => {
      if (isConnected && address && chainId) {
        try {
          setIsLoading(true);
          
          // Fetch NFT count
          const nftCount = await nftService.getUserNftCount(config, chainId, address);
          setOwnedNfts(nftCount);
          
          // Update CPU count based on NFT ownership
          setMiningState(prev => ({
            ...prev,
            cpuCount: Math.min(nftCount, 1) // Default to at least 1, max is user's NFT count
          }));
          
          // Fetch mining stats
          const stats = await miningService.getMiningStats(address);
          if (stats) {
            console.log('Mining stats received:', stats);
            
            // Ensure totalPoints is a number
            let totalPointsValue = 0;
            if (typeof stats.totalPoints === 'number') {
              totalPointsValue = stats.totalPoints;
            } else if (typeof stats.totalPoints === 'string') {
              totalPointsValue = parseFloat(stats.totalPoints);
            }
            
            // Handle NaN or invalid values
            if (isNaN(totalPointsValue)) {
              totalPointsValue = 0;
            }
            
            console.log('Setting total points to:', totalPointsValue);
            setTotalPoints(totalPointsValue);
            
            // If there's an active session from the server, restore it
            if (stats.activeSession) {
              console.log('Active mining session found for wallet:', address);
              const startTime = new Date(stats.activeSession.start_time).getTime();
              // Ensure mining rate is a number
              let miningRate = 0.0045; // Default value
              if (typeof stats.activeSession.mining_rate === 'number') {
                miningRate = stats.activeSession.mining_rate;
              } else if (typeof stats.activeSession.mining_rate === 'string') {
                miningRate = parseFloat(stats.activeSession.mining_rate);
                if (isNaN(miningRate)) miningRate = 0.0045; // Default if parsing fails
              }
              
              const cpuCount = stats.activeSession.cpu_count;
              const coresPerCpu = stats.activeSession.cores_per_cpu || 12;
              const ramPerCpu = stats.activeSession.ram_per_cpu || 500;
              
              // Update mining state with server data
              setMiningState({
                isActive: true,
                startTime,
                cpuCount,
                coresPerCpu,
                ramPerCpu,
                miningRate,
                totalPoints: totalPointsValue
              });
              
              // Save to localStorage with wallet address for verification
              localStorage.setItem('miningSession', JSON.stringify({
                isActive: true,
                startTime,
                cpuCount,
                coresPerCpu,
                ramPerCpu,
                miningRate,
                walletAddress: address // Store wallet address for verification
              }));
            } else {
              // No active session in database, clear any localStorage session
              localStorage.removeItem('miningSession');
              // Reset mining state if it was active
              if (miningState.isActive) {
                setMiningState(prev => ({
                  ...prev,
                  isActive: false,
                  startTime: null
                }));
                setCurrentPoints(0);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          toast({
            description: "Failed to fetch your data. Please try again.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setOwnedNfts(0);
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [isConnected, address, chainId, config]);
  
  // Calculate mining rate based on CPU count only
  useEffect(() => {
    // Only update mining rate if not in an active session
    // This prevents overwriting the rate from the server during an active session
    if (!miningState.isActive) {
      const baseRate = 0.0045;
      const newRate = baseRate * miningState.cpuCount; // Each CPU contributes the full base rate
      
      setMiningState(prev => ({
        ...prev,
        miningRate: parseFloat(newRate.toFixed(4)) // Limit to 4 decimal places for cleaner display
      }));
    }
  }, [miningState.cpuCount, miningState.isActive]);
  
  // Handle real-time counter
  useEffect(() => {
    // Only start counting if we're connected and have an active mining session
    if (miningState.isActive && miningState.startTime && isConnected && address) {
      // Clear any existing interval
      if (counterInterval) {
        window.clearInterval(counterInterval);
      }
      
      // Verify the session belongs to the current wallet
      const savedSession = localStorage.getItem('miningSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          // If the saved session has a different wallet address, don't count points
          if (session.walletAddress && session.walletAddress !== address) {
            console.log('Mining session belongs to a different wallet, stopping counter');
            setCounterInterval(null);
            return;
          }
        } catch (error) {
          console.error('Error parsing saved mining session:', error);
        }
      }
      
      // Start a new interval
      const interval = window.setInterval(() => {
        if (miningState.startTime && typeof miningState.startTime === 'number') {
          const elapsedSeconds = (Date.now() - miningState.startTime) / 1000;
          const miningRate = typeof miningState.miningRate === 'number' ? miningState.miningRate : 0.0045;
          const points = miningRate * elapsedSeconds;
          setCurrentPoints(Number(points)); // Ensure it's a number
        }
      }, 16); // Update approximately every 16ms (60fps) for very smooth counting
      
      setCounterInterval(interval);
    } else {
      // Clear interval when mining stops or wallet disconnects
      if (counterInterval) {
        window.clearInterval(counterInterval);
        setCounterInterval(null);
      }
    }
    
    // Cleanup on component unmount
    return () => {
      if (counterInterval) {
        window.clearInterval(counterInterval);
      }
    };
  }, [miningState.isActive, miningState.startTime, miningState.miningRate, isConnected, address]);
  
  // We removed the periodic refresh to reduce database load
  
  // Start mining
  const startMining = async () => {
    if (!isConnected) {
      toast({
        description: "Please connect your wallet to start mining.",
        variant: "destructive",
      });
      return;
    }
    
    if (ownedNfts === 0) {
      toast({
        description: "You need to own at least one Kaleido SuperNode NFT to mine.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      if (!address) {
        toast({
          description: "Wallet address not found.",
          variant: "destructive",
        });
        return;
      }

      // Set loading state
      setIsMiningActionLoading(true);
      
      // Calculate the mining rate based on CPU count only
      const miningRate = miningState.cpuCount * 0.0045;
      
      // Start mining session using the service
      const result = await miningService.startMining(
        address,
        miningState.cpuCount,
        miningState.coresPerCpu,
        miningState.ramPerCpu,
        miningRate
      );
      
      if (result.success) {
        const newState = {
          ...miningState,
          isActive: true,
          startTime: Date.now(),
          miningRate // Update with calculated rate
        };
        
        // Update state
        setMiningState(newState);
        
        // Save to localStorage for persistence with wallet address
        localStorage.setItem('miningSession', JSON.stringify({
          ...newState,
          walletAddress: address // Store wallet address for verification
        }));
        
        toast({
          description: "Your premium node is now mining points.",
        });
      } else {
        toast({
          description: result.message || "Failed to start mining. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error starting mining:", error);
      toast({
        description: "An error occurred while starting mining.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state
      setIsMiningActionLoading(false);
    }
  };
  
  // Stop mining
  const stopMining = async () => {
    if (!miningState.isActive) return;
    
    if (!address) {
      toast({
        description: "Wallet address not available. Please reconnect your wallet.",
        variant: "destructive",
      });
      return;
    }
    
    // Set loading state
    setIsMiningActionLoading(true);
    
    try {
      // Calculate the current session points more precisely before stopping
      let sessionPoints = currentPoints;
      if (miningState.startTime && typeof miningState.startTime === 'number') {
        const elapsedSeconds = (Date.now() - miningState.startTime) / 1000;
        const miningRate = typeof miningState.miningRate === 'number' ? miningState.miningRate : 0.0045;
        sessionPoints = miningRate * elapsedSeconds;
      }
      
      // Stop mining session using the service
      const result = await miningService.stopMining(address, sessionPoints);
      
      if (result.success) {
        // Update state
        setMiningState(prev => ({
          ...prev,
          isActive: false,
          startTime: null
        }));
        
        // Clear from localStorage
        localStorage.removeItem('miningSession');
        
        // Reset current points counter
        setCurrentPoints(0);
        
        // Update total points - ensure we're working with numbers
        let earnedPoints = 0;
        if (typeof result.pointsEarned === 'number') {
          earnedPoints = result.pointsEarned;
        } else if (typeof result.pointsEarned === 'string') {
          earnedPoints = parseFloat(result.pointsEarned);
        }
        
        // Handle NaN or invalid values
        if (isNaN(earnedPoints)) {
          earnedPoints = 0;
        }
        
        // If server returns 0 but we have calculated points, use our calculation
        if (earnedPoints === 0 && sessionPoints > 0) {
          console.log('Server returned 0 points, using calculated session points instead:', sessionPoints);
          earnedPoints = sessionPoints;
        }
        
        // Update total points immediately with earned points
        setTotalPoints(prev => {
          const currentTotal = typeof prev === 'number' ? prev : 0;
          const newTotal = currentTotal + earnedPoints;
          return newTotal;
        });
        
        // Refresh mining stats to get the latest total from the server
        if (address) {
          setTimeout(async () => {
            try {
              const stats = await miningService.getMiningStats(address);
              if (stats) {
                // Process the total points from the server
                let totalPointsValue = 0;
                if (typeof stats.totalPoints === 'number') {
                  totalPointsValue = stats.totalPoints;
                } else if (typeof stats.totalPoints === 'string') {
                  totalPointsValue = parseFloat(stats.totalPoints);
                }
                
                // Handle NaN or invalid values
                if (isNaN(totalPointsValue)) {
                  totalPointsValue = 0;
                }
                
                // Only update if the server value is greater than our current value
                setTotalPoints(prev => {
                  if (totalPointsValue > prev) {
                    return totalPointsValue;
                  }
                  return prev;
                });
              }
            } catch (error) {
              console.error('Error refreshing mining stats:', error);
            }
          }, 1500); // Slightly longer delay to ensure server has processed the update
        }
        
        // Display earned points with proper formatting to avoid showing 0 due to rounding
        let pointsDisplay;
        
        if (earnedPoints === 0) {
          // If server returned 0, use our calculated value instead
          pointsDisplay = sessionPoints.toFixed(6);
        } else if (earnedPoints < 0.000001) {
          // For very small numbers, show more decimal places
          pointsDisplay = earnedPoints.toFixed(8);
        } else {
          // Normal case
          pointsDisplay = earnedPoints.toFixed(6);
        }
        
        toast({
          title: "Mining Stopped",
          description: `You earned ${pointsDisplay} points this session.`,
        });
      } else {
        toast({
          description: result.message || "Failed to stop mining. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error stopping mining:", error);
      toast({
        description: "Failed to stop mining. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Reset loading state
      setIsMiningActionLoading(false);
    }
  };
  
  // Format large numbers with commas
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Gradient background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />
      
      <Header />
      
      <main className="container mx-auto px-8 sm:px-12 lg:px-24 pt-24 pb-20 relative max-w-[1400px]">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-400 via-white to-emerald-400 bg-clip-text text-transparent">
            Premium Node Mining
          </h1>
          
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-300 text-lg mb-6">
              CUSTOMIZE YOUR SUPERNODE RESOURCES AND START MINING
            </p>
            <p className="text-emerald-400/90 text-lg mb-8">
              Adjust CPU cores and RAM to optimize your mining performance ⚡
            </p>
          </div>
        </div>

        {/* Mining Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
          {/* Left Column - Node Visualization */}
          <div className="space-y-6">
            {/* NFT Visualization */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
              <div className="aspect-square rounded-xl overflow-hidden">
                <video
                  src="/nft.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Mining Status */}
              <div className="mt-6 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-medium text-emerald-400">Kaleido SuperNode XVD26F</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Mining Rate: <span className="text-emerald-400">{miningState.miningRate.toFixed(4)} points/sec</span>
                    </p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg px-4 py-2 border border-emerald-500/30">
                    <div className="text-emerald-400/60 text-xs uppercase text-center">Your Nodes</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent text-center">
                      {isLoading ? "Loading..." : ownedNfts}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mint Card */}
              <div className="mt-8">
                <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
                  <div className="flex flex-col space-y-4">
                    <div className="text-gray-400 text-sm">
                      Node Fees: <span className="text-emerald-400">0.00043370 Abstract ETH</span>
                    </div>
                    
                    <MintButton onSuccess={(tokenId) => {
                      console.log('Minted token ID:', tokenId);
                      // You could trigger confetti or other celebrations here
                    }} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Technical Specs */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-4 text-emerald-400">Technical Specifications</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-emerald-400/60 mb-1">Node Type</div>
                  <div className="text-xl font-semibold">SuperNode XVD26F</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-400/60 mb-1">Processing Power</div>
                  <div className="text-xl font-semibold">26.5 TFLOPS</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-400/60 mb-1">Memory Configuration</div>
                  <div className="text-xl font-semibold">384GB HBM3</div>
                </div>
                <div>
                  <div className="text-sm text-emerald-400/60 mb-1">Network Bandwidth</div>
                  <div className="text-xl font-semibold">100 Gbps</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Configuration */}
          <div className="space-y-6">
            {/* Points Counter */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-4 text-emerald-400">Mining Progress</h3>
              
              <div className="bg-zinc-800/70 rounded-xl p-6 border border-emerald-500/30 mb-4">
                <div className="text-sm text-emerald-400/60 mb-2">Current Session Points</div>
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-10 bg-emerald-400/20 rounded-md w-3/4 mb-2"></div>
                  </div>
                ) : (
                  <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent">
                    {typeof currentPoints === 'number' ? currentPoints.toFixed(12) : '0.000000000000'}
                  </div>
                )}
                
                {miningState.isActive && (
                  <div className="mt-4 flex items-center">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2"></div>
                    <span className="text-emerald-400/80 text-sm">Mining in progress...</span>
                  </div>
                )}
              </div>
              
              <div className="bg-zinc-800/70 rounded-xl p-6 border border-emerald-500/30">
                <div className="text-sm text-emerald-400/60 mb-2">Total Accumulated Points</div>
                {isLoading ? (
                  <div className="animate-pulse">
                    <div className="h-10 bg-emerald-400/20 rounded-md w-2/3 mb-2"></div>
                  </div>
                ) : (
                  <div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent">
                    {typeof totalPoints === 'number' ? totalPoints.toFixed(8) : '0.00000000'}
                  </div>
                )}
              </div>
              
              <div className="mt-6">
                <Button
                  onClick={miningState.isActive ? stopMining : startMining}
                  className={`w-full py-6 text-lg font-medium ${
                    miningState.isActive 
                      ? "bg-red-500 hover:bg-red-600 text-white" 
                      : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-black hover:from-emerald-400 hover:to-emerald-300"
                  }`}
                  disabled={!isConnected || isLoading || isMiningActionLoading || (ownedNfts === 0 && !miningState.isActive)}
                >
                  {isMiningActionLoading ? (
                    <>
                      <span className="animate-pulse mr-2">⏳</span>
                      {miningState.isActive ? "STOPPING..." : "STARTING..."}
                    </>
                  ) : (
                    miningState.isActive ? "STOP MINING" : "START MINING"
                  )}
                </Button>
              </div>
            </div>
            
            {/* Resource Configuration */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20 relative group">
              <h3 className="text-lg font-medium mb-6 text-emerald-400">Node Configuration</h3>
              
              {/* Warning notification when mining is active */}
              {miningState.isActive && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl z-10">
                  <div className="bg-red-950/90 border border-red-500/30 p-4 rounded-lg max-w-md text-center">
                    <div className="flex items-center justify-center mb-2 text-red-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-semibold">Mining In Progress</span>
                    </div>
                    <p className="text-gray-300 text-sm">
                      You must stop mining before adjusting node configuration.
                    </p>
                    <button 
                      onClick={stopMining}
                      className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium text-sm"
                      disabled={isMiningActionLoading}
                    >
                      {isMiningActionLoading ? "Stopping..." : "Stop Mining Now"}
                    </button>
                  </div>
                </div>
              )}
              
              {/* CPU Count */}
              <div className="mb-8">
                <div className="flex justify-between mb-2">
                  <div className="text-sm text-emerald-400/60">CPU Count</div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (miningState.isActive) {
                          toast({
                            title: "Mining in progress",
                            description: "You must stop mining before adjusting node configuration.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (miningState.cpuCount > 1) {
                          setMiningState(prev => ({
                            ...prev,
                            cpuCount: prev.cpuCount - 1
                          }));
                        }
                      }}
                      disabled={miningState.isActive || miningState.cpuCount <= 1}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-lg font-bold">-</span>
                    </button>
                    <div className="text-sm text-white">{miningState.cpuCount} / {ownedNfts}</div>
                    <button 
                      onClick={() => {
                        if (miningState.isActive) {
                          toast({
                            title: "Mining in progress",
                            description: "You must stop mining before adjusting node configuration.",
                            variant: "destructive",
                          });
                          return;
                        }
                        if (miningState.cpuCount < ownedNfts) {
                          setMiningState(prev => ({
                            ...prev,
                            cpuCount: prev.cpuCount + 1
                          }));
                        }
                      }}
                      disabled={miningState.isActive || miningState.cpuCount >= ownedNfts}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span className="text-lg font-bold">+</span>
                    </button>
                  </div>
                </div>
                <Slider
                  disabled={miningState.isActive || ownedNfts === 0}
                  value={[miningState.cpuCount]}
                  min={1}
                  max={Math.max(1, ownedNfts)}
                  step={1}
                  onValueChange={(value) => {
                    if (miningState.isActive) {
                      toast({
                        title: "Mining in progress",
                        description: "You must stop mining before adjusting node configuration.",
                        variant: "destructive",
                      });
                      return;
                    }
                    setMiningState(prev => ({
                      ...prev,
                      cpuCount: value[0]
                    }));
                  }}
                  className="mb-4"
                />
                <div className="text-xs text-gray-400">
                  Each CPU represents one of your Kaleido SuperNode NFTs
                </div>
              </div>
            </div>
            
            {/* Mining Stats */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-6 text-emerald-400">Mining Statistics</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-sm text-emerald-400/60 mb-1">Active CPUs</div>
                  <div className="text-xl font-semibold">
                    {miningState.cpuCount > 0 
                      ? miningState.cpuCount 
                      : <span className="text-emerald-400/60">1 (default)</span>
                    }
                  </div>
                </div>
                
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-sm text-emerald-400/60 mb-1">Total Cores</div>
                  <div className="text-xl font-semibold">
                    {miningState.cpuCount > 0 
                      ? miningState.cpuCount * 12 
                      : <span className="text-emerald-400/60">12 (default)</span>
                    }
                  </div>
                </div>
                
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-sm text-emerald-400/60 mb-1">Total RAM</div>
                  <div className="text-xl font-semibold">
                    {miningState.cpuCount > 0 
                      ? formatNumber(miningState.cpuCount * 500) 
                      : <span className="text-emerald-400/60">500 GB (default)</span>
                    }
                  </div>
                </div>
                
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-sm text-emerald-400/60 mb-1">Mining Rate</div>
                  <div className="text-xl font-semibold">
                    {miningState.cpuCount > 0 
                      ? miningState.miningRate.toFixed(4) 
                      : <span className="text-emerald-400/60">0.0045 pts/sec (default)</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PremiumMining;
