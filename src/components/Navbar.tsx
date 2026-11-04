import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Film, Compass, Layers, Bookmark, Users, Camera, User, LogIn, LogOut, Menu, X } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenOnboarding }) => {
  const { user, userProfile, signIn, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Film },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'swipe', label: 'Movie Swipe', icon: Layers },
    { id: 'library', label: 'My Library', icon: Bookmark },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'scan', label: 'Scan', icon: Camera },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#091A2B]/95 backdrop-blur-md border-b border-[#10283F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2 text-left shrink-0 cursor-pointer group"
          >
            <span className="text-2xl font-serif font-bold tracking-tight text-[#F7F2E9] group-hover:text-[#D9B66F] transition-colors">
              PLOT TWIST
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9B66F]" aria-hidden="true" />
          </button>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 py-1 whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#D9B66F] font-semibold border-b-2 border-[#D9B66F]'
                      : 'text-[#F7F2E9]/70 hover:text-[#F7F2E9]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action / User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleNavClick('profile')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                    activeTab === 'profile'
                      ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                      : 'bg-[#10283F]/60 border-[#10283F] text-[#F7F2E9] hover:bg-[#10283F]'
                  }`}
                  aria-label="My Profile"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User profile'}
                      className="w-5 h-5 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-4 h-4 text-[#D9B66F]" />
                  )}
                  <span className="hidden sm:inline max-w-[120px] truncate">
                    {userProfile?.displayName || user.displayName || 'Profile'}
                  </span>
                </button>
                <button
                  onClick={() => signOut()}
                  className="p-1.5 text-[#F7F2E9]/60 hover:text-[#F7F2E9] hover:bg-[#10283F] rounded-md transition-colors cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#091A2B] bg-[#D9B66F] hover:bg-[#D9B66F]/90 rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In with Google</span>
              </button>
            )}

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#F7F2E9]/80 hover:text-[#F7F2E9] hover:bg-[#10283F] rounded-md"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#091A2B] border-b border-[#10283F] px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#10283F] text-[#D9B66F]'
                    : 'text-[#F7F2E9]/80 hover:bg-[#10283F]/50 hover:text-[#F7F2E9]'
                }`}
              >
                <Icon className="w-5 h-5 text-[#D9B66F]" />
                <span>{item.label}</span>
              </button>
            );
          })}
          {user && (
            <button
              onClick={() => handleNavClick('profile')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left text-[#F7F2E9]/80 hover:bg-[#10283F]/50"
            >
              <User className="w-5 h-5 text-[#D9B66F]" />
              <span>My Profile</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
