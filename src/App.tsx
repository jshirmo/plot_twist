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

function AppContent() {
  const { user, userProfile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Sync with URL query or hash if provided (e.g. ?tab=swipe or ?autostart=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
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
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <HomePage
            onNavigate={setActiveTab}
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

      <Footer onNavigate={setActiveTab} />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onComplete={() => {
          setOnboardingOpen(false);
          setActiveTab('discover');
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
