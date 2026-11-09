import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { SavedMediaItem, SwipeDecisionRecord } from '../types';
import { getUserSavedMedia, removeSavedMedia, updateMediaStatus, getUserSwipeHistory } from '../lib/mediaService';
import { Film, BookOpen, Tv, Radio, CheckCircle, ThumbsUp, ThumbsDown, Trash2, RotateCcw } from 'lucide-react';

type LibraryTab = 'movies' | 'books' | 'tv' | 'podcasts' | 'completed' | 'passed';

export const LibraryPage: React.FC = () => {
  const { user, signIn } = useAuth();
  const [activeTab, setActiveTab] = useState<LibraryTab>('movies');
  const [savedItems, setSavedItems] = useState<SavedMediaItem[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<SwipeDecisionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequest = useRef(0);

  const loadData = async () => {
    if (!user) return;
    const request = ++loadRequest.current;
    setLoading(true);
    setActionError(null);
    setLoadError(null);
    try {
      const [media, swipes] = await Promise.all([
        getUserSavedMedia(user.uid),
        getUserSwipeHistory(user.uid),
      ]);
      if (request !== loadRequest.current) return;
      setSavedItems(media || []);
      setSwipeHistory(swipes || []);
    } catch (err) {
      console.error('Failed to load library data:', err);
      if (request === loadRequest.current) {
        setLoadError('Could not load your library. Use Refresh Library to try again.');
      }
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    setSavedItems([]);
    setSwipeHistory([]);
    setLoadError(null);
    setActionError(null);
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
    return () => { loadRequest.current += 1; };
  }, [user?.uid]);

  const handleRemove = async (item: SavedMediaItem) => {
    setPendingId(item.id);
    setActionError(null);
    try {
      await removeSavedMedia(item.mediaId, item.mediaType);
      setSavedItems((prev) => prev.filter((saved) => saved.id !== item.id));
    } catch (err) {
      console.error('Error removing item:', err);
      setActionError('Could not remove this title. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const handleStatusChange = async (item: SavedMediaItem, status: SavedMediaItem['status']) => {
    setPendingId(item.id);
    setActionError(null);
    try {
      await updateMediaStatus(item.mediaId, status, undefined, undefined, item.mediaType);
      // Finishing a title is distinct from liking it.
      setSavedItems((prev) =>
        prev.map((saved) => saved.id === item.id ? { ...saved, status } : saved)
      );
    } catch (err) {
      console.error('Error changing status:', err);
      setActionError('Could not update this title’s status. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const handleRate = async (item: SavedMediaItem, rating: 'liked' | 'disliked') => {
    setPendingId(item.id);
    setActionError(null);
    try {
      await updateMediaStatus(item.mediaId, 'completed', rating, undefined, item.mediaType);
      setSavedItems((prev) =>
        prev.map((saved) =>
          saved.id === item.id ? { ...saved, status: 'completed', rating } : saved
        )
      );
    } catch (err) {
      console.error('Error rating item:', err);
      setActionError('Could not save your rating. Please try again.');
    } finally {
      setPendingId(null);
    }
  };

  const handleRestore = async (item: SavedMediaItem) => {
    setPendingId(item.id);
    setActionError(null);
    try {
      await updateMediaStatus(item.mediaId, 'watchlist', undefined, undefined, item.mediaType);
      setSavedItems((prev) =>
        prev.map((saved) => saved.id === item.id ? { ...saved, status: 'watchlist' } : saved)
      );
    } catch (err) {
      console.error('Error restoring item:', err);
      setActionError('Could not restore this title. Please try again.');
    } finally {
      setPendingId(null);
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

  const currentItems = savedItems.filter((item) => {
    if (activeTab === 'completed') return item.status === 'completed';
    if (item.status === 'completed' || item.status === 'passed') return false;
    const formatTabs: Record<string, SavedMediaItem['mediaType']> = {
      movies: 'movie', books: 'book', tv: 'tv', podcasts: 'podcast',
    };
    return item.mediaType === formatTabs[activeTab];
  });

  const passedMedia = savedItems.filter((item) => item.status === 'passed');
  const passedSwipes = swipeHistory.filter((swipe) =>
    swipe.decision === 'pass' && swipe.feedbackStatus === 'active' &&
    !savedItems.some((item) => item.mediaId === swipe.mediaId && item.mediaType === swipe.mediaType)
  );

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
          disabled={loading || pendingId !== null}
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
          { id: 'passed' as LibraryTab, label: 'Passed Items', icon: RotateCcw },
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

      {actionError && (
        <p role="alert" className="rounded-lg border border-rose-600/50 p-3 text-sm text-rose-300">
          {actionError}
        </p>
      )}

      {loadError && <p role="alert" className="rounded-lg border border-rose-600/50 p-3 text-sm text-rose-300">{loadError}</p>}

      {/* Passed items across all formats, including Kai's active swipe history. */}
      {!loading && !loadError && activeTab === 'passed' && (
        <div className="space-y-4">
          <p className="text-xs text-[#F7F2E9]/70">
            Titles you passed on, across movies, TV, books, and podcasts.
          </p>
          {passedMedia.length === 0 && passedSwipes.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#F7F2E9]/50">
              No passed titles recorded yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {passedMedia.map((item) => (
                <div key={item.id} className="bg-[#10283F]/30 border border-[#10283F] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.posterUrl && <img src={item.posterUrl} alt="" className="w-12 h-16 object-cover rounded-md bg-[#091A2B]" />}
                    <div className="min-w-0">
                      <h4 className="font-serif font-bold text-sm text-[#F7F2E9] line-clamp-1">{item.title}</h4>
                      <span className="text-xs text-[#F7F2E9]/50 uppercase">{item.mediaType}</span>
                    </div>
                  </div>
                  <button
                    disabled={pendingId !== null}
                    onClick={() => handleRestore(item)}
                    className="text-xs text-[#D9B66F] disabled:opacity-50 cursor-pointer"
                    aria-label={`Restore ${item.title} to library`}
                  >Restore</button>
                </div>
              ))}
              {passedSwipes.map((swipe) => (
                <div key={swipe.id} className="bg-[#10283F]/30 border border-[#10283F] rounded-xl p-4 flex items-center gap-3">
                  {swipe.posterUrl && <img src={swipe.posterUrl} alt="" className="w-12 h-16 object-cover rounded-md bg-[#091A2B]" />}
                  <div className="min-w-0">
                    <h4 className="font-serif font-bold text-sm text-[#F7F2E9] line-clamp-1">{swipe.title}</h4>
                    <span className="text-xs text-[#F7F2E9]/50 uppercase">{swipe.mediaType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Media Items View */}
      {!loading && !loadError && activeTab !== 'passed' && (
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

                      <label className="block pt-2 text-xs text-[#F7F2E9]/60">
                        Status
                        <select
                          aria-label={`Status for ${item.title}`}
                          value={item.status}
                          disabled={pendingId !== null}
                          onChange={(event) => handleStatusChange(item, event.target.value as SavedMediaItem['status'])}
                          className="mt-1 block w-full rounded-lg border border-[#10283F] bg-[#091A2B] px-3 py-2 text-[#F7F2E9] disabled:opacity-50"
                        >
                          <option value="watchlist">Saved for later</option>
                          {item.mediaType === 'book' ? <option value="reading">Reading</option>
                            : item.mediaType === 'podcast' ? <option value="listening">Listening</option>
                            : <option value="watching">Watching</option>}
                          <option value="completed">Completed</option>
                        </select>
                      </label>

                      {/* Enjoyment rating for completed items */}
                      {item.status === 'completed' && (
                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="text-[#F7F2E9]/60">Your Rating:</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRate(item, 'liked')}
                              disabled={pendingId !== null}
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
                              onClick={() => handleRate(item, 'disliked')}
                              disabled={pendingId !== null}
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
                        onClick={() => handleStatusChange(item, 'completed')}
                        disabled={pendingId !== null}
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
                      onClick={() => handleRemove(item)}
                      disabled={pendingId !== null}
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

