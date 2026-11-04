import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Sparkles, Sliders, LogOut, CheckCircle2, RefreshCw } from 'lucide-react';

interface ProfilePageProps {
  onOpenOnboarding: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenOnboarding }) => {
  const { user, userProfile, signOut, signIn } = useAuth();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-6">
        <User className="w-12 h-12 text-[#D9B66F] mx-auto" />
        <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">
          Sign In to Access Your Profile
        </h2>
        <button
          onClick={() => signIn()}
          className="px-6 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  const taste = userProfile?.tasteProfile;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* User Header */}
      <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User profile'}
              className="w-16 h-16 rounded-full border-2 border-[#D9B66F] object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#10283F] border-2 border-[#D9B66F] flex items-center justify-center text-[#D9B66F]">
              <User className="w-8 h-8" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold text-[#F7F2E9]">
              {userProfile?.displayName || user.displayName || 'Plot Twist User'}
            </h1>
            <span className="text-xs text-[#F7F2E9]/60">{user.email}</span>
            <div className="flex items-center gap-1.5 pt-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Account</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenOnboarding}
            className="px-4 py-2 bg-[#10283F] hover:bg-[#10283F]/80 text-[#D9B66F] border border-[#D9B66F]/40 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retake Questionnaire</span>
          </button>
          <button
            onClick={() => signOut()}
            className="p-2 text-[#F7F2E9]/60 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Taste Profile Breakdown */}
      <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#10283F] pb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
            Personalized Preferences
          </span>
          <h2 className="text-xl font-serif font-bold text-[#F7F2E9]">Your Story DNA</h2>
        </div>

        {taste ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Preferred Genres
              </span>
              <div className="flex flex-wrap gap-1.5">
                {taste.preferredGenres.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#F7F2E9]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Favorite Formats
              </span>
              <div className="flex flex-wrap gap-1.5">
                {taste.preferredFormats.map((f) => (
                  <span
                    key={f}
                    className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#D9B66F] uppercase"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Stories You Love
              </span>
              <div className="flex flex-wrap gap-1.5">
                {taste.favoriteStories.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#F7F2E9]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Key Story Elements
              </span>
              <div className="flex flex-wrap gap-1.5">
                {taste.storyElements.map((el) => (
                  <span
                    key={el}
                    className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#F7F2E9]"
                  >
                    {el}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Typical Available Time
              </span>
              <span className="text-xs text-[#F7F2E9] font-medium">{taste.timeAvailability}</span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F7F2E9]/50 block">
                Streaming Services
              </span>
              <div className="flex flex-wrap gap-1.5">
                {taste.streamingServices.map((svc) => (
                  <span
                    key={svc}
                    className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#2C7A7B]"
                  >
                    {svc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-[#F7F2E9]/60">You haven't completed the taste questionnaire yet.</p>
            <button
              onClick={onOpenOnboarding}
              className="px-5 py-2.5 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-lg cursor-pointer"
            >
              Take Taste Questionnaire
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
