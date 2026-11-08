import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavedMediaItem } from '../types';
import { getUserSavedMedia } from '../lib/mediaService';
import { User, LogOut, CheckCircle2, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';

interface ProfilePageProps {
  onOpenOnboarding: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenOnboarding }) => {
  const { user, userProfile, signOut, signIn } = useAuth();
  const [ratedTitles, setRatedTitles] = useState<SavedMediaItem[]>([]);
  const [ratingsError, setRatingsError] = useState(false);

  useEffect(() => {
    let active = true;
    setRatedTitles([]);
    setRatingsError(false);
    if (user) {
      getUserSavedMedia(user.uid)
        .then((items) => {
          if (active) {
            setRatedTitles(items.filter((item) =>
              item.status === 'completed' && (item.rating === 'liked' || item.rating === 'disliked')
            ));
          }
        })
        .catch((error) => {
          console.error('Failed to load rated titles:', error);
          if (active) setRatingsError(true);
        });
    }
    return () => { active = false; };
  }, [user?.uid]);

  const likedTitles = ratedTitles.filter((item) => item.rating === 'liked');
  const dislikedCount = ratedTitles.length - likedTitles.length;
  const topValues = (values: string[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([value]) => value);
  };
  const topGenres = topValues(likedTitles.flatMap((item) => item.genres ?? []));
  const favoriteFormats = topValues(likedTitles.map((item) => item.mediaType));


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

      {/* Ratings-derived preferences; never confuse questionnaire choices with actual ratings. */}
      <section className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 sm:p-8 space-y-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">Based on your ratings</span>
          <h2 className="text-xl font-serif font-bold text-[#F7F2E9]">Your Taste So Far</h2>
        </div>
        {ratingsError ? (
          <p role="alert" className="text-sm text-rose-300">Could not load your ratings. Try reopening your profile.</p>
        ) : ratedTitles.length === 0 ? (
          <p className="text-sm text-[#F7F2E9]/70">
            Rate finished books, movies, TV shows, and podcasts to build your taste summary.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-sm text-[#F7F2E9]">
              <span><strong>{ratedTitles.length}</strong> rated</span>
              <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-emerald-400" />{likedTitles.length} liked</span>
              <span className="flex items-center gap-1"><ThumbsDown className="w-4 h-4 text-rose-400" />{dislikedCount} disliked</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[#F7F2E9]/60 mb-2">Top liked genres</h3>
                <p className="text-sm text-[#F7F2E9]">{topGenres.join(' · ') || 'No genres rated yet'}</p>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wider text-[#F7F2E9]/60 mb-2">Favorite formats</h3>
                <p className="text-sm text-[#F7F2E9] capitalize">{favoriteFormats.join(' · ') || 'No favorite format yet'}</p>
              </div>
            </div>
          </>
        )}
      </section>

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
