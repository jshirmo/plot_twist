import React from 'react';

interface FooterProps {
  onNavigate: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#091A2B] border-t border-[#10283F] py-12 text-[#F7F2E9]/60 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <span className="font-serif font-bold text-lg text-[#F7F2E9] tracking-tight">
              PLOT TWIST
            </span>
            <p className="text-xs text-[#F7F2E9]/50">
              Personalized entertainment discovery across books, movies, TV shows, and podcasts.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
            <button onClick={() => onNavigate('home')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Home
            </button>
            <button onClick={() => onNavigate('discover')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Discover
            </button>
            <button onClick={() => onNavigate('near-you')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Near You
            </button>
            <button onClick={() => onNavigate('swipe')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Movie Swipe
            </button>
            <button onClick={() => onNavigate('library')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              My Library
            </button>
            <button onClick={() => onNavigate('groups')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Groups
            </button>
            <button onClick={() => onNavigate('scan')} className="hover:text-[#F7F2E9] transition-colors cursor-pointer">
              Scan
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-[#10283F] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#F7F2E9]/40">
          <span>&copy; {new Date().getFullYear()} Plot Twist. All rights reserved.</span>
          <span>Powered by Google Gemini AI & Verified Catalogs.</span>
        </div>
      </div>
    </footer>
  );
};
