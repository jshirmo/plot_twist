import React, { useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { MovieSwipeCard } from '../types';
import { recordSwipeDecision, undoLastSwipeDecision } from '../lib/mediaService';
import { Heart, X, RotateCcw, Sparkles, Film, Clock, Tv, CheckCircle2, ChevronRight } from 'lucide-react';

export const MovieSwipePage: React.FC = () => {
  const { user, userProfile, signIn } = useAuth();
  const [deck, setDeck] = useState<MovieSwipeCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<'interested' | 'pass' | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Motion drag values for current top card
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacityLike = useTransform(x, [20, 120], [0, 1]);
  const opacityPass = useTransform(x, [-120, -20], [1, 0]);

  // Load Swipe Deck from API
  const fetchDeck = useCallback(async () => {
    setLoading(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/swipe-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasteProfile: userProfile?.tasteProfile,
        }),
      });
      const data = await res.json();
      setDeck(data.deck || []);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to load swipe deck:', err);
      setStatusNotice('Failed to load movie deck. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const currentMovie = deck[currentIndex];
  const nextMovie = deck[currentIndex + 1];

  const handleDecision = useCallback(
    async (decision: 'interested' | 'pass') => {
      if (!currentMovie) return;

      setLastAction(decision);
      setUndoAvailable(true);

      // If user is authenticated, persist in Firestore
      if (user) {
        try {
          await recordSwipeDecision({
            mediaId: currentMovie.id,
            title: currentMovie.title,
            posterUrl: currentMovie.posterUrl,
            mediaType: 'movie',
            decision,
            feedbackStatus: 'active',
            genres: currentMovie.genres,
          });
        } catch (err) {
          console.error('Error saving swipe to Firestore:', err);
        }
      }

      // Advance deck index
      setCurrentIndex((prev) => prev + 1);
    },
    [currentMovie, user]
  );

  const handleUndo = async () => {
    if (currentIndex === 0) return;

    if (!user) {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setUndoAvailable(false);
      setStatusNotice('Reversed last swipe');
      setTimeout(() => setStatusNotice(null), 3000);
      return;
    }

    try {
      const reversed = await undoLastSwipeDecision(user.uid);
      if (reversed) {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
        setUndoAvailable(false);
        setStatusNotice(`Reversed last swipe on ${reversed.title}`);
        setTimeout(() => setStatusNotice(null), 3500);
      }
    } catch (err) {
      console.error('Error undoing swipe:', err);
    }
  };

  // Keyboard navigation (ArrowLeft = Pass, ArrowRight = Interested, KeyZ = Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleDecision('interested');
      } else if (e.key === 'ArrowLeft') {
        handleDecision('pass');
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center min-h-[calc(100vh-5rem)] justify-center">
      {/* Title Header */}
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">
          Movie Swipe Deck
        </h1>
        <p className="text-xs text-[#F7F2E9]/70">
          Swipe Right to add to Watchlist · Swipe Left to pass · Tap Undo if you change your mind
        </p>
      </div>

      {statusNotice && (
        <div className="mb-4 px-4 py-2 bg-[#10283F] border border-[#D9B66F]/50 rounded-lg text-xs text-[#D9B66F] animate-fade-in">
          {statusNotice}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="w-80 h-[480px] rounded-3xl bg-[#10283F]/30 border border-[#10283F] flex items-center justify-center">
          <span className="text-sm text-[#D9B66F] animate-pulse">Loading movie deck...</span>
        </div>
      )}

      {/* Empty Deck State */}
      {!loading && !currentMovie && (
        <div className="w-full max-w-md p-10 bg-[#10283F]/30 border border-[#10283F] rounded-3xl text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-[#D9B66F] mx-auto" />
          <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">
            You've Reached the End of This Deck!
          </h2>
          <p className="text-sm text-[#F7F2E9]/70">
            Great choices! Your right swipes have been saved to your Movie Watchlist in Firestore.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={fetchDeck}
              className="px-6 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:bg-[#D9B66F]/90 transition-all"
            >
              Refresh Deck
            </button>
            {undoAvailable && (
              <button
                onClick={handleUndo}
                className="px-6 py-3 bg-[#10283F] text-[#F7F2E9] border border-[#10283F] font-semibold text-xs uppercase tracking-wider rounded-xl cursor-pointer hover:border-[#D9B66F]"
              >
                Undo Last Swipe
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Swipe Deck Card Stack */}
      {!loading && currentMovie && (
        <div className="relative w-full max-w-sm h-[520px]">
          {/* Card Behind (Next Card preview) */}
          {nextMovie && (
            <div
              className="absolute inset-0 bg-[#091A2B] border border-[#10283F] rounded-3xl overflow-hidden shadow-xl scale-95 translate-y-3 pointer-events-none opacity-60"
              aria-hidden="true"
            >
              <img
                src={nextMovie.posterUrl}
                alt={nextMovie.title}
                className="w-full h-3/5 object-cover"
              />
              <div className="p-4 space-y-1">
                <span className="text-xs text-[#D9B66F] font-semibold">{nextMovie.genres.join(', ')}</span>
                <h3 className="font-serif font-bold text-base text-[#F7F2E9]">{nextMovie.title}</h3>
              </div>
            </div>
          )}

          {/* Top Interactive Card */}
          <motion.div
            style={{ x, rotate }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            onDragEnd={(_e, info) => {
              if (info.offset.x > 100) {
                handleDecision('interested');
              } else if (info.offset.x < -100) {
                handleDecision('pass');
              }
            }}
            className="absolute inset-0 bg-[#091A2B] border border-[#10283F] rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing flex flex-col justify-between"
          >
            {/* Visual Directional Drag Indicators */}
            <motion.div
              style={{ opacity: opacityLike }}
              className="absolute top-5 right-5 z-20 px-3.5 py-1.5 border-2 border-emerald-400 bg-emerald-950/80 rounded-xl text-emerald-300 font-bold text-xs uppercase tracking-wider shadow-lg rotate-12"
            >
              INTERESTED
            </motion.div>
            <motion.div
              style={{ opacity: opacityPass }}
              className="absolute top-5 left-5 z-20 px-3.5 py-1.5 border-2 border-rose-500 bg-rose-950/80 rounded-xl text-rose-300 font-bold text-xs uppercase tracking-wider shadow-lg -rotate-12"
            >
              PASS
            </motion.div>

            {/* Poster Header */}
            <div className="relative h-3/5 w-full bg-[#10283F] overflow-hidden">
              <img
                src={currentMovie.posterUrl}
                alt={currentMovie.title}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#091A2B] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-baseline justify-between">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#F7F2E9] leading-tight drop-shadow-md">
                    {currentMovie.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-[#F7F2E9]/70 pt-0.5">
                    <span>{currentMovie.releaseYear}</span>
                    <span aria-hidden="true">·</span>
                    <span>{currentMovie.genres.slice(0, 2).join(', ')}</span>
                    {currentMovie.runtimeMinutes && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{currentMovie.runtimeMinutes} min</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
              <p className="text-xs text-[#F7F2E9]/80 line-clamp-3 leading-relaxed">
                {currentMovie.overview}
              </p>

              {/* AI explanation highlight */}
              <div className="bg-[#10283F]/60 border border-[#D9B66F]/30 rounded-xl p-2.5 text-xs text-[#D9B66F]">
                <div className="flex items-center gap-1 font-semibold text-[10px] uppercase text-[#F7F2E9]/60">
                  <Sparkles className="w-3 h-3 text-[#D9B66F]" />
                  <span>AI Plot Match</span>
                </div>
                <p className="italic text-[11px] leading-tight pt-0.5">
                  "{currentMovie.aiExplanation}"
                </p>
              </div>

              {currentMovie.streamingProviders && currentMovie.streamingProviders.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#F7F2E9]/60">
                  <Tv className="w-3 h-3 text-[#D9B66F]" />
                  <span>Stream on: {currentMovie.streamingProviders.join(', ')}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Dedicated Action Buttons (Pass, Undo, Interested) */}
      {!loading && currentMovie && (
        <div className="flex items-center gap-6 mt-8">
          {/* Pass Button */}
          <button
            onClick={() => handleDecision('pass')}
            className="w-14 h-14 rounded-full bg-[#10283F]/70 border border-rose-500/50 hover:bg-rose-950/60 hover:border-rose-500 text-rose-400 flex items-center justify-center transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Pass on this movie"
            title="Pass (Left Arrow)"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Undo Button */}
          <button
            onClick={handleUndo}
            disabled={currentIndex === 0}
            className="w-11 h-11 rounded-full bg-[#10283F]/70 border border-[#D9B66F]/40 hover:bg-[#10283F] text-[#D9B66F] flex items-center justify-center transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
            aria-label="Undo last swipe"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Interested / Watchlist Button */}
          <button
            onClick={() => handleDecision('interested')}
            className="w-14 h-14 rounded-full bg-[#10283F]/70 border border-emerald-500/50 hover:bg-emerald-950/60 hover:border-emerald-500 text-emerald-400 flex items-center justify-center transition-all shadow-lg cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Interested in this movie"
            title="Interested (Right Arrow)"
          >
            <Heart className="w-6 h-6 fill-emerald-400/20" />
          </button>
        </div>
      )}
    </div>
  );
};
