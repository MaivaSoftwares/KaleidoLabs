import { Link, useLocation } from 'react-router-dom';
import { Home, Grid3X3, Pickaxe } from 'lucide-react';

export default function MobileNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Determine active state for each nav item
  const isHome = currentPath === '/' || currentPath === '/index';
  const isGallery = currentPath === '/gallery';
  const isMining = currentPath === '/premium-mining';
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-md border-t border-emerald-500/20 md:hidden z-50">
      <div className="container mx-auto px-4 py-2">
        <div className="flex justify-around items-center">
          {/* Home Button */}
          <Link 
            to="/" 
            className={`flex flex-col items-center p-2 ${isHome ? 'text-emerald-400' : 'text-gray-400'}`}
          >
            <Home size={24} className={`mb-1 ${isHome ? 'text-emerald-400' : 'text-gray-400'}`} />
            <span className="text-xs font-medium">Home</span>
          </Link>
          
          {/* Gallery Button */}
          <Link 
            to="/gallery" 
            className={`flex flex-col items-center p-2 ${isGallery ? 'text-emerald-400' : 'text-gray-400'}`}
          >
            <Grid3X3 size={24} className={`mb-1 ${isGallery ? 'text-emerald-400' : 'text-gray-400'}`} />
            <span className="text-xs font-medium">Gallery</span>
          </Link>
          
          {/* Mining Button */}
          <Link 
            to="/premium-mining" 
            className={`flex flex-col items-center p-2 ${isMining ? 'text-emerald-400' : 'text-gray-400'}`}
          >
            <Pickaxe size={24} className={`mb-1 ${isMining ? 'text-emerald-400' : 'text-gray-400'}`} />
            <span className="text-xs font-medium">Mining</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
