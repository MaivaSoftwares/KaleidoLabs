import React from 'react';
import { Helmet } from 'react-helmet';
import { useAccount } from 'wagmi';
import NFTGallery from '@/components/NFTGallery';
import { useEffect, useState } from 'react';
import galleryService from '@/services/gallery';
import Header from '@/components/Header';
import MintCounter from '@/components/MintCounter';
import { formatNumberWithSuffix } from '@/utils/numberFormat';

const GalleryPage: React.FC = () => {
  const { isConnected } = useAccount();
  const [stats, setStats] = useState<{ total_mints: number; unique_owners: number }>({ total_mints: 0, unique_owners: 0 });

  useEffect(() => {
    const loadStats = async () => {
      const nftStats = await galleryService.getNFTStats();
      setStats(nftStats);
    };

    loadStats();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Gradient background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />
      
      <Helmet>
        <title>NFT Gallery | Kaleido Super Node</title>
        <meta name="description" content="View your Kaleido Super Node NFT collection" />
      </Helmet>

      <Header />

      <main className="container mx-auto px-8 sm:px-12 lg:px-24 pt-24 pb-20 relative max-w-[1400px]">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-emerald-400 via-white to-emerald-400 bg-clip-text text-transparent">
            Kaleido SuperNode Gallery
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Explore your collection of Kaleido Super Node NFTs. Each node represents a powerful
            component in the Kaleido network with unique attributes and capabilities.
          </p>
          
          <div className="flex justify-center gap-12 mt-8">
            <div className="text-center bg-zinc-900/80 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/20 min-w-[150px]">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent">
                <MintCounter />
              </div>
              <div className="text-sm text-emerald-400/60 mt-1">Total Minted</div>
            </div>
            <div className="text-center bg-zinc-900/80 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/20 min-w-[150px]">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-white bg-clip-text text-transparent">
                {formatNumberWithSuffix(stats.unique_owners)}
              </div>
              <div className="text-sm text-emerald-400/60 mt-1">Unique Owners</div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-6 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <NFTGallery />
        </div>
      </main>
    </div>
  );
};

export default GalleryPage;
