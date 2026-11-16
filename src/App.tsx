/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { OnboardingModal } from './components/OnboardingModal';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MovieSwipePage } from './pages/MovieSwipePage';
import { LibraryPage } from './pages/LibraryPage';
import { GroupsPage } from './pages/GroupsPage';
import { NearYouPage } from './pages/NearYouPage';
import { ScanPage } from './pages/ScanPage';
import { ProfilePage } from './pages/ProfilePage';

const tabs = new Set(['home', 'discover', 'swipe', 'library', 'groups', 'near-you', 'scan', 'profile']);

function tabFromUrl() {
  const url = new URL(window.location.href);
  const tab = url.searchParams.get('tab') ?? (url.pathname.replace(/^\/|\/$/g, '') || 'home');
  return tabs.has(tab) ? tab : 'home';
}

function AppContent() {
  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  const navigate = (tab: string) => {
    const url = new URL(window.location.href);
    url.pathname = tab === 'home' ? '/' : `/${tab}`;
    url.searchParams.delete('tab');
    url.hash = '';
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const restoreTab = () => setActiveTab(tabFromUrl());
    window.addEventListener('popstate', restoreTab);
    return () => window.removeEventListener('popstate', restoreTab);
  }, []);

  // When a user signs in and onboarding is not completed, automatically prompt onboarding
  useEffect(() => {
    if (user && userProfile && userProfile.onboardingCompleted === false) {
      setOnboardingOpen(true);
    }
  }, [user, userProfile]);

  return (
    <div className="min-h-screen flex flex-col bg-[#091A2B] text-[#F7F2E9]">
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigate}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePage
            onNavigate={navigate}
            onOpenOnboarding={() => setOnboardingOpen(true)}
          />
        )}
        {activeTab === 'discover' && <DiscoverPage />}
        {activeTab === 'swipe' && <MovieSwipePage />}
        {activeTab === 'library' && <LibraryPage />}
        {activeTab === 'groups' && <GroupsPage />}
        {activeTab === 'near-you' && <NearYouPage />}
        {activeTab === 'scan' && <ScanPage />}
        {activeTab === 'profile' && (
          <ProfilePage onOpenOnboarding={() => setOnboardingOpen(true)} />
        )}
      </main>

      <Footer onNavigate={navigate} />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onComplete={() => {
          setOnboardingOpen(false);
          navigate('discover');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
