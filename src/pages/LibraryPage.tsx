import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavedMediaItem, MediaType, SwipeDecisionRecord } from '../types';
import { getUserSavedMedia, removeSavedMedia, updateMediaStatus, getUserSwipeHistory } from '../lib/mediaService';
import { Film, BookOpen, Tv, Radio, CheckCircle, ThumbsUp, ThumbsDown, Trash2, ArrowRight, RotateCcw, Clock } from 'lucide-react';

type LibraryTab = 'movies' | 'books' | 'tv' | 'podcasts' | 'completed' | 'passed';

export const LibraryPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState<LibraryTab>('movies');
  const [savedItems, setSavedItems] = useState<SavedMediaItem[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<SwipeDecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [media, swipes] = await Promise.all([
        getUserSavedMedia(user.uid),
        getUserSwipeHistory(user.uid),
      ]);
      setSavedItems(media || []);
      setSwipeHistory(swipes || []);
    } catch (err) {
      console.error('Failed to load library data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleRemove = async (mediaId: string) => {
    if (!user) return;
    try {
      await removeSavedMedia(mediaId);
      setSavedItems((prev) => prev.filter((item) => item.mediaId !== mediaId));
    } catch (err) {
      console.error('Error removing item:', err);
    }
  };

  const handleMarkCompleted = async (item: SavedMediaItem) => {
    if (!user) return;
    try {
      await updateMediaStatus(item.mediaId, 'completed', 'liked');
      setSavedItems((prev) =>
        prev.map((i) => (i.mediaId === item.mediaId ? { ...i, status: 'completed', rating: 'liked' } : i))
      );
    } catch (err) {
      console.error('Error marking completed:', err);
    }
  };

  const handleRate = async (mediaId: string, rating: 'liked' | 'disliked' | 'neutral') => {
    if (!user) return;
    try {
      await updateMediaStatus(mediaId, 'completed', rating);
      setSavedItems((prev) =>
        prev.map((i) => (i.mediaId === mediaId ? { ...i, rating } : i))
      );
    } catch (err) {
      console.error('Error rating item:', err);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <Film className="w-12 h-12 text-[#D9B66F] mx-auto" />
        <h2 className="text-3xl font-serif font-bold text-[#F7F2E9]">
          Sign in to View Your Library
        </h2>
        <p className="text-sm text-[#F7F2E9]/70">
          Your saved watchlists, completed reviews, and swipe history are securely associated with your individual Google account.
        </p>
        <button
          onClick={() => signIn()}
          className="px-6 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  // Filter items based on activeTab
  const getFilteredItems = () => {
    if (activeTab === 'movies') {
      return savedItems.filter((i) => i.mediaType === 'movie' && i.status !== 'completed');
    }
    if (activeTab === 'books') {
      return savedItems.filter((i) => i.mediaType === 'book' && i.status !== 'completed');
    }
    if (activeTab === 'tv') {
      return savedItems.filter((i) => i.mediaType === 'tv' && i.status !== 'completed');
    }
    if (activeTab === 'podcasts') {
      return savedItems.filter((i) => i.mediaType === 'podcast' && i.status !== 'completed');
    }
    if (activeTab === 'completed') {
      return savedItems.filter((i) => i.status === 'completed');
    }
    return [];
  };

  const currentItems = getFilteredItems();
  const passedSwipes = swipeHistory.filter((s) => s.decision === 'pass' && s.feedbackStatus === 'active');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#10283F] pb-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">My Library</h1>
          <p className="text-xs text-[#F7F2E9]/70 pt-1">
            Track your watchlists, finished stories, and review swipe decisions
          </p>
        </div>
        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-[#10283F] hover:bg-[#10283F]/80 text-[#D9B66F] border border-[#10283F] rounded-lg text-xs font-semibold cursor-pointer"
        >
          Refresh Library
        </button>
      </div>

      {/* Categorized Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#10283F] pb-4">
        {[
          { id: 'movies' as LibraryTab, label: 'Movie Watchlist', icon: Film },
          { id: 'books' as LibraryTab, label: 'Books to Read', icon: BookOpen },
          { id: 'tv' as LibraryTab, label: 'TV Watchlist', icon: Tv },
          { id: 'podcasts' as LibraryTab, label: 'Podcasts to Listen', icon: Radio },
          { id: 'completed' as LibraryTab, label: 'Completed Media', icon: CheckCircle },
          { id: 'passed' as LibraryTab, label: 'Passed Movies', icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                  : 'bg-[#10283F]/20 border-transparent text-[#F7F2E9]/60 hover:text-[#F7F2E9]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center text-sm text-[#D9B66F] animate-pulse">
          Loading your saved library from Firestore...
        </div>
      )}

      {/* Passed Movies View */}
      {!loading && activeTab === 'passed' && (
        <div className="space-y-4">
          <p className="text-xs text-[#F7F2E9]/70">
            Movies you previously swiped left on. You can restore them to receive future recommendations.
          </p>
          {passedSwipes.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#F7F2E9]/50">
              No passed movies recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {passedSwipes.map((swipe) => (
                <div
                  key={swipe.id}
                  className="bg-[#10283F]/30 border border-[#10283F] rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={swipe.posterUrl}
                      alt={swipe.title}
                      className="w-12 h-16 object-cover rounded-md bg-[#091A2B]"
                    />
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#F7F2E9] line-clamp-1">{swipe.title}</h4>
                      <span className="text-xs text-[#F7F2E9]/50">{swipe.genres.join(', ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media Items View */}
      {!loading && activeTab !== 'passed' && (
        <>
          {currentItems.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-sm text-[#F7F2E9]/60">
                No items saved in this category yet.
              </p>
              <p className="text-xs text-[#F7F2E9]/40">
                Explore the Discover feed or swipe through movies to add titles!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl overflow-hidden flex flex-col justify-between hover:border-[#D9B66F]/40 transition-colors"
                >
                  <div>
                    <div className="relative h-48 w-full bg-[#091A2B]">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3 bg-[#091A2B]/80 px-2 py-0.5 rounded text-[11px] font-semibold text-[#D9B66F] uppercase">
                        {item.mediaType}
                      </div>
                    </div>

                    <div className="p-5 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <h3 className="font-serif font-bold text-base text-[#F7F2E9] line-clamp-1">
                          {item.title}
                        </h3>
                        {item.releaseYear && (
                          <span className="text-xs text-[#F7F2E9]/50">{item.releaseYear}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-[#F7F2E9]/60">
                        {item.creator && <span>{item.creator}</span>}
                        {item.creator && <span aria-hidden="true">·</span>}
                        <span>{item.genres.slice(0, 2).join(', ')}</span>
                      </div>

                      {item.overview && (
                        <p className="text-xs text-[#F7F2E9]/70 line-clamp-2 leading-relaxed pt-1">
                          {item.overview}
                        </p>
                      )}

                      {/* Enjoyment rating for completed items */}
                      {item.status === 'completed' && (
                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="text-[#F7F2E9]/60">Your Rating:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRate(item.mediaId, 'liked')}
                              className={`p-1.5 rounded-lg border cursor-pointer ${
                                item.rating === 'liked'
                                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400'
                                  : 'border-[#10283F] text-[#F7F2E9]/50'
                              }`}
                              title="Enjoyed it"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRate(item.mediaId, 'disliked')}
                              className={`p-1.5 rounded-lg border cursor-pointer ${
                                item.rating === 'disliked'
                                  ? 'bg-rose-950/60 border-rose-500 text-rose-400'
                                  : 'border-[#10283F] text-[#F7F2E9]/50'
                              }`}
                              title="Didn't enjoy"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-4 border-t border-[#10283F] flex items-center justify-between bg-[#10283F]/20">
                    {item.status !== 'completed' ? (
                      <button
                        onClick={() => handleMarkCompleted(item)}
                        className="text-xs font-semibold text-[#D9B66F] hover:text-[#D9B66F]/80 flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Mark Finished</span>
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleRemove(item.mediaId)}
                      className="p-1.5 text-rose-400/70 hover:text-rose-400 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                      title="Remove from library"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
