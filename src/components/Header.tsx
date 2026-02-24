import WalletButton from "./WalletButton";
import { Link } from "react-router-dom";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-md">
      <div className="container mx-auto px-2 sm:px-4 lg:px-8 py-4 flex justify-between items-center max-w-[1400px]">
        <div className="flex items-center shrink-0">
          <Link to="/" className="text-white font-bold text-xl sm:text-2xl flex items-center">
            KALEIDO <span className="ml-2 text-xs sm:text-sm px-2 py-1 bg-white/10 rounded">LABS</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
          {/* Desktop Navigation - Hidden on mobile */}
          <nav className="hidden md:block overflow-hidden">
            <ul className="flex items-center space-x-2 lg:space-x-6">
              <li>
                <Link 
                  to="/gallery" 
                  className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium px-2 sm:px-4 py-1.5 flex items-center whitespace-nowrap text-sm lg:text-base"
                >
                  Gallery
                </Link>
              </li>
              <li className="shrink-0">
                <a 
                  href="https://relay.link/bridge/abstract?toCurrency=0x0000000000000000000000000000000000000000" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium px-2 sm:px-4 py-1.5 flex items-center whitespace-nowrap text-sm lg:text-base"
                >
                  Bridge to Abstract
                </a>
              </li>
              <li className="shrink-0">
                <Link 
                  to="/premium-mining" 
                  className="relative group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-emerald-600/80 to-emerald-400/80 rounded-md blur-sm opacity-75 group-hover:opacity-100 transition-all duration-300"></span>
                  <span className="relative px-2 sm:px-4 py-1.5 rounded-md bg-gradient-to-r from-emerald-900/90 to-emerald-800/90 border border-emerald-400/30 text-emerald-300 font-semibold flex items-center group-hover:text-white transition-colors text-sm lg:text-base">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 sm:mr-1.5 text-emerald-400 group-hover:text-emerald-200" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    <span className="whitespace-nowrap">Premium Mining</span>
                    <span className="ml-1 sm:ml-1.5 text-xs px-1 sm:px-1.5 py-0.5 bg-emerald-500/30 rounded text-emerald-200 group-hover:bg-emerald-400/40">PRO</span>
                  </span>
                </Link>
              </li>
            </ul>
          </nav>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
