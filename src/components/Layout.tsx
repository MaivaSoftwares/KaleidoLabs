import React from 'react';
import Header from './Header';
import MobileNav from './MobileNav';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Gradient background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 via-black to-black pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />
      
      <Header />
      
      <main className="container mx-auto px-2 sm:px-4 lg:px-8 pt-24 pb-24 md:pb-20 relative max-w-[1400px]">
        {children}
      </main>
      
      {/* Add padding at the bottom on mobile to account for the navigation bar */}
      <div className="h-16 md:hidden"></div>
      
      <MobileNav />
    </div>
  );
}
