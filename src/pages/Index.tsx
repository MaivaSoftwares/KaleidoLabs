import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useAccount, useConnect } from 'wagmi';
import { nftCollection } from "@/data/nftProjects";
import MintButton from "@/components/MintButton";
import MintCounter from "@/components/MintCounter";

const Index = () => {
  const { address, isConnected } = useAccount();

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
          Kaleido SuperNode XVD26F
          </h1>
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm">
              🆓 FREE MINT
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-emerald-400/80">10 NODE PER WALLET</span>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <p className="text-gray-300 text-lg mb-6">
              KALEIDO SUPER NODE NFT: YOUR KEY TO PREMIUM POINT MINING
            </p>
            <p className="text-emerald-400/90 text-lg mb-8">
              Exclusive access to premium point mining with customizable server resources. Mint yours now! ⚡
            </p>
          </div>
          
          
        </div>

        {/* Left Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-24">
          <div className="space-y-6">
            {/* NFT Preview */}
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
      </div>
      
            {/* Mint Status */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
                  <div>
                    <h3 className="text-xl font-medium text-emerald-400">Kaleido SuperNode XVD26F</h3>
                    <p className="text-gray-400 text-sm mt-1">Node Fees: <span className="text-emerald-400">0.00043370 Abstract ETH</span></p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg px-4 py-2 border border-emerald-500/30 self-start sm:self-auto">
                    <div className="text-emerald-400/60 text-xs uppercase text-center">Total Minted</div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent text-center">
                      <MintCounter />
                    </div>
                  </div>
                </div>
                
                <MintButton onSuccess={(tokenId) => {
                  console.log('Minted token ID:', tokenId);
                  // You could trigger confetti or other celebrations here
                }} />
              </div>
            </div>
          </div>
          
          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Collection Info */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-4 text-emerald-400">Collection Details</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-emerald-400/60 mb-1">Supply</div>
                    <div className="text-xl font-semibold">20000</div>
                  </div>
                  <div>
                    <div className="text-sm text-emerald-400/60 mb-1">Max Mint</div>
                    <div className="text-xl font-semibold">10 per wallet</div>
                  </div>
                </div>

            <div>
                  <div className="text-sm text-emerald-400/60 mb-2">Supported Chains</div>
                  <div className="space-y-3">
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        <div className="font-medium">Abstract Chain</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Mint Fee: 0.00043370 Abstract ETH 
                      </div>
                    </div>
                    
                    {/* Monad Testnet support temporarily disabled
                    <div className="bg-zinc-800/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        <div className="font-medium">Monad Testnet</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        Mint Fee: 0.5 $MON Testnet Token
                      </div>
                    </div>
                    */}
                  </div>
                </div>
              </div>
            </div>

            {/* Technical Specs */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-4 text-emerald-400">Technical Specifications</h3>
              <div className="space-y-4">
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
            
            {/* Benefits */}
            <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20">
              <h3 className="text-lg font-medium mb-4 text-emerald-400">Node Benefits</h3>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Why? You will be mining kaleido premium points in real-time
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  You can select custom CPU cores and RAM
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Why? Have a chance to increase you premium points in real time
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">•</span>
                  Why? This feature is exclusive only to NFT holders
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
