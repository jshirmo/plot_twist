import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { MediaType, MovieSwipeCard, SwipeDecisionRecord } from '../types';
import { getUserSwipeHistory, recordSwipeDecision, undoLastSwipeDecision } from '../lib/mediaService';
import { CheckCircle2, Heart, RotateCcw, Sparkles, Tv, X } from 'lucide-react';

const formatOptions: Array<{ value: MediaType; label: string; libraryLabel: string }> = [
  { value: 'movie', label: 'Movies', libraryLabel: 'Movie Watchlist' },
  { value: 'tv', label: 'TV', libraryLabel: 'TV Watchlist' },
  { value: 'book', label: 'Books', libraryLabel: 'Books to Read' },
  { value: 'podcast', label: 'Podcasts', libraryLabel: 'Podcasts to Listen' },
];
const anonymousHistoryKey = 'plot-twist:anonymous-swipe-history:v1';
const deckSeedsKey = 'plot-twist:swipe-deck-seeds:v1';
const deckPagesKey = 'plot-twist:swipe-deck-pages:v1';

interface SwipeTasteSignals {
  formatScores: Record<MediaType, number>;
  genreScores: Record<string, number>;
  topFormats: MediaType[];
  topGenres: string[];
  avoidedGenres: string[];
  summary: string;
}

interface SwipeDeckResponse {
  deck: MovieSwipeCard[];
  tasteSignals?: SwipeTasteSignals;
}

function activeSwipes(records: SwipeDecisionRecord[]) {
  return records.filter((record) => record.feedbackStatus === 'active');
}

function readSessionValue<T>(key: string, fallback: T): T {
  try {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionValue(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The swipe deck remains usable when browser storage is unavailable.
  }
}

export const MovieSwipePage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const [deck, setDeck] = useState<MovieSwipeCard[]>([]);
  const [swipeHistory, setSwipeHistory] = useState<SwipeDecisionRecord[]>([]);
  const [tasteSignals, setTasteSignals] = useState<SwipeTasteSignals | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDecision, setSavingDecision] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const sessionHistoryRef = useRef<SwipeDecisionRecord[]>(readSessionValue(anonymousHistoryKey, []));
  const deckSeedsRef = useRef<Partial<Record<MediaType, number>>>(readSessionValue(deckSeedsKey, {}));
  const deckPagesRef = useRef<Partial<Record<MediaType, number>>>(readSessionValue(deckPagesKey, {}));

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacityLike = useTransform(x, [20, 120], [0, 1]);
  const opacityPass = useTransform(x, [-120, -20], [1, 0]);

  const selectedFormat = formatOptions.find((option) => option.value === mediaType)!;
  const currentMedia = deck[0];
  const nextMedia = deck[1];
  const undoAvailable = activeSwipes(swipeHistory).length > 0;

  const deckSeedFor = useCallback((format: MediaType) => {
    const savedSeed = deckSeedsRef.current[format];
    if (typeof savedSeed === 'number' && Number.isFinite(savedSeed)) return savedSeed;

    const bytes = new Uint32Array(1);
    window.crypto?.getRandomValues?.(bytes);
    const seed = bytes[0] || Math.floor(Math.random() * 2 ** 32);
    deckSeedsRef.current = { ...deckSeedsRef.current, [format]: seed };
    writeSessionValue(deckSeedsKey, deckSeedsRef.current);
    return seed;
  }, []);

  const requestDeck = useCallback(async (history: SwipeDecisionRecord[]) => {
    const activeHistory = activeSwipes(history);
    const res = await fetch('/api/swipe-deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType,
        deckSeed: deckSeedFor(mediaType),
        page: deckPagesRef.current[mediaType] ?? 1,
        tasteProfile: userProfile?.tasteProfile,
        excludedMediaIds: activeHistory
          .filter((record) => record.mediaType === mediaType)
          .map((record) => record.mediaId),
        swipeHistory: activeHistory,
      }),
    });
    if (!res.ok) throw new Error(`Swipe deck request failed (${res.status})`);
    const data = await res.json() as Partial<SwipeDeckResponse>;
    return {
      deck: Array.isArray(data.deck) ? data.deck : [],
      tasteSignals: data.tasteSignals,
    };
  }, [deckSeedFor, mediaType, userProfile?.tasteProfile]);

  const loadDeck = useCallback(async (restart = false) => {
    setLoading(true);
    setStatusNotice(null);
    try {
      let records = sessionHistoryRef.current;
      if (user) records = await getUserSwipeHistory(user.uid);
      if (restart) {
        const nextPage = Math.min(50, (deckPagesRef.current[mediaType] ?? 1) + 1);
        deckPagesRef.current = { ...deckPagesRef.current, [mediaType]: nextPage };
        writeSessionValue(deckPagesKey, deckPagesRef.current);
        delete deckSeedsRef.current[mediaType];
      }
      const response = await requestDeck(records);
      setSwipeHistory(records);
      setDeck(response.deck);
      setTasteSignals(response.tasteSignals ?? null);
    } catch (error) {
      console.error('Failed to load swipe deck:', error);
      setSwipeHistory([]);
      setDeck([]);
      setStatusNotice('Failed to load this deck. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [mediaType, requestDeck, user]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  const refreshWithHistory = useCallback(async (nextHistory: SwipeDecisionRecord[]) => {
    try {
      const response = await requestDeck(nextHistory);
      setDeck(response.deck);
      setTasteSignals(response.tasteSignals ?? null);
    } catch (error) {
      console.error('Failed to refresh swipe deck:', error);
      setStatusNotice('Your swipe was saved, but the next deck could not load. Refresh to continue.');
    }
  }, [requestDeck]);

  const handleDecision = useCallback(async (decision: 'interested' | 'pass') => {
    if (!currentMedia || savingDecision) return;

    setSavingDecision(true);
    const swipeData = {
      mediaId: currentMedia.id,
      title: currentMedia.title,
      posterUrl: currentMedia.posterUrl,
      mediaType: currentMedia.mediaType,
      decision,
      feedbackStatus: 'active' as const,
      genres: currentMedia.genres,
      moodTags: currentMedia.moodTags,
    };

    try {
      const record: SwipeDecisionRecord = user
        ? await recordSwipeDecision(swipeData)
        : {
            ...swipeData,
            id: `session_${currentMedia.mediaType}_${currentMedia.id}_${Date.now()}`,
            userId: 'anonymous',
            createdAt: new Date().toISOString(),
          };
      const nextHistory = [record, ...swipeHistory.filter((item) => item.id !== record.id)];
      if (!user) {
        sessionHistoryRef.current = nextHistory;
        writeSessionValue(anonymousHistoryKey, nextHistory);
      }
      setSwipeHistory(nextHistory);
      setDeck((currentDeck) => currentDeck.slice(1));
      await refreshWithHistory(nextHistory);
      setStatusNotice(
        user
          ? decision === 'interested'
            ? `Saved ${currentMedia.title} to ${formatOptions.find((item) => item.value === currentMedia.mediaType)?.libraryLabel}.`
            : `Passed on ${currentMedia.title}.`
          : 'Swipe saved for this session. Sign in to keep your history across devices.'
      );
    } catch (error) {
      console.error('Error saving swipe decision:', error);
      setStatusNotice('We could not save that swipe. Please try again.');
    } finally {
      setSavingDecision(false);
    }
  }, [currentMedia, refreshWithHistory, savingDecision, swipeHistory, user]);

  const handleUndo = useCallback(async () => {
    if (!undoAvailable || savingDecision) return;
    setSavingDecision(true);
    try {
      let reversed: SwipeDecisionRecord | undefined;
      if (user) {
        reversed = await undoLastSwipeDecision(user.uid) ?? undefined;
      } else {
        reversed = activeSwipes(swipeHistory)[0];
      }
      if (!reversed) return;

      const nextHistory = swipeHistory.map((record) =>
        record.id === reversed!.id ? { ...record, feedbackStatus: 'reversed' as const } : record
      );
      if (!user) {
        sessionHistoryRef.current = nextHistory;
        writeSessionValue(anonymousHistoryKey, nextHistory);
      }
      setSwipeHistory(nextHistory);
      await refreshWithHistory(nextHistory);
      setStatusNotice(`Reversed last swipe on ${reversed.title}.`);
    } catch (error) {
      console.error('Error undoing swipe:', error);
      setStatusNotice('We could not undo that swipe. Please try again.');
    } finally {
      setSavingDecision(false);
    }
  }, [refreshWithHistory, savingDecision, swipeHistory, undoAvailable, user]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') void handleDecision('interested');
      else if (event.key === 'ArrowLeft') void handleDecision('pass');
      else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision, handleUndo]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center min-h-[calc(100vh-5rem)] justify-center">
      <div className="text-center space-y-2 mb-5">
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">{selectedFormat.label} Swipe Deck</h1>
        <p className="text-xs text-[#F7F2E9]/70">
          Swipe right to save · swipe left to pass · use Undo if you change your mind
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 mb-6" role="group" aria-label="Choose a media format">
        {formatOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMediaType(option.value)}
            disabled={savingDecision}
            aria-pressed={mediaType === option.value}
            className={`rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
              mediaType === option.value
                ? 'border-[#D9B66F] bg-[#D9B66F] text-[#091A2B]'
                : 'border-[#10283F] bg-[#10283F]/40 text-[#F7F2E9] hover:border-[#D9B66F]/60'
            } disabled:opacity-50`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tasteSignals && activeSwipes(swipeHistory).length > 0 && (
        <div className="mb-4 max-w-xl rounded-xl border border-[#D9B66F]/30 bg-[#10283F]/50 px-4 py-2 text-center text-xs text-[#F7F2E9]/75" aria-live="polite">
          <span className="font-semibold text-[#D9B66F]">Learning from your swipes: </span>
          {tasteSignals.summary}
        </div>
      )}

      {statusNotice && (
        <div className="mb-4 px-4 py-2 bg-[#10283F] border border-[#D9B66F]/50 rounded-lg text-xs text-[#D9B66F]" role="status">
          {statusNotice}
        </div>
      )}

      {loading && (
        <div className="w-80 h-[480px] rounded-3xl bg-[#10283F]/30 border border-[#10283F] flex items-center justify-center">
          <span className="text-sm text-[#D9B66F] animate-pulse">Loading {selectedFormat.label.toLowerCase()}...</span>
        </div>
      )}

      {!loading && !currentMedia && (
        <div className="w-full max-w-md p-10 bg-[#10283F]/30 border border-[#10283F] rounded-3xl text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-[#D9B66F] mx-auto" />
          <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">No new titles in this batch</h2>
          <p className="text-sm text-[#F7F2E9]/70">Refresh to look for more. Previously swiped titles stay in your history.</p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => void loadDeck(true)} className="px-6 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#D9B66F]/90 transition-all">Refresh Deck</button>
            {undoAvailable && <button onClick={() => void handleUndo()} className="px-6 py-3 bg-[#10283F] text-[#F7F2E9] border border-[#10283F] font-semibold text-xs uppercase tracking-wider rounded-xl hover:border-[#D9B66F]">Undo Last Swipe</button>}
          </div>
        </div>
      )}

      {!loading && currentMedia && (
        <div className="relative w-full max-w-sm h-[520px]">
          {nextMedia && (
            <div className="absolute inset-0 bg-[#091A2B] border border-[#10283F] rounded-3xl overflow-hidden shadow-xl scale-95 translate-y-3 pointer-events-none opacity-60" aria-hidden="true">
              <img src={nextMedia.posterUrl} alt="" className="w-full h-3/5 object-cover" />
              <div className="p-4 space-y-1"><span className="text-xs text-[#D9B66F] font-semibold">{nextMedia.genres.join(', ')}</span><h3 className="font-serif font-bold text-base text-[#F7F2E9]">{nextMedia.title}</h3></div>
            </div>
          )}

          <motion.div
            style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.8}
            onDragEnd={(_event, info) => {
              if (info.offset.x > 100) void handleDecision('interested');
              else if (info.offset.x < -100) void handleDecision('pass');
            }}
            className="absolute inset-0 bg-[#091A2B] border border-[#10283F] rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing flex flex-col justify-between"
          >
            <motion.div style={{ opacity: opacityLike }} className="absolute top-5 right-5 z-20 px-3.5 py-1.5 border-2 border-emerald-400 bg-emerald-950/80 rounded-xl text-emerald-300 font-bold text-xs uppercase tracking-wider shadow-lg rotate-12">INTERESTED</motion.div>
            <motion.div style={{ opacity: opacityPass }} className="absolute top-5 left-5 z-20 px-3.5 py-1.5 border-2 border-rose-500 bg-rose-950/80 rounded-xl text-rose-300 font-bold text-xs uppercase tracking-wider shadow-lg -rotate-12">PASS</motion.div>

            <div className="relative h-3/5 w-full bg-[#10283F] overflow-hidden">
              <img src={currentMedia.posterUrl} alt={currentMedia.title} className="w-full h-full object-cover select-none pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#091A2B] via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-baseline justify-between">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-[#F7F2E9] leading-tight drop-shadow-md">{currentMedia.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[#F7F2E9]/70 pt-0.5">
                    <span>{currentMedia.releaseYear}</span><span aria-hidden="true">·</span><span>{currentMedia.genres.slice(0, 2).join(', ')}</span>
                    {currentMedia.pageCount ? <><span aria-hidden="true">·</span><span>{currentMedia.pageCount} pages</span></> : currentMedia.runtimeMinutes ? <><span aria-hidden="true">·</span><span>{currentMedia.runtimeMinutes} min</span></> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
              <p className="text-xs text-[#F7F2E9]/80 line-clamp-3 leading-relaxed">{currentMedia.overview}</p>
              <div className="bg-[#10283F]/60 border border-[#D9B66F]/30 rounded-xl p-2.5 text-xs text-[#D9B66F]">
                <div className="flex items-center gap-1 font-semibold text-[10px] uppercase text-[#F7F2E9]/60"><Sparkles className="w-3 h-3 text-[#D9B66F]" /><span>AI Plot Match · {currentMedia.compatibilityScore}%</span></div>
                <p className="italic text-[11px] leading-tight pt-0.5">"{currentMedia.aiExplanation}"</p>
              </div>
              {currentMedia.streamingProviders?.length ? <div className="flex items-center gap-1.5 text-[11px] text-[#F7F2E9]/60"><Tv className="w-3 h-3 text-[#D9B66F]" /><span>Available on: {currentMedia.streamingProviders.join(', ')}</span></div> : null}
            </div>
          </motion.div>
        </div>
      )}

      {!loading && currentMedia && (
        <div className="flex items-center gap-6 mt-8">
          <button onClick={() => void handleDecision('pass')} disabled={savingDecision} className="w-14 h-14 rounded-full bg-[#10283F]/70 border border-rose-500/50 hover:bg-rose-950/60 hover:border-rose-500 text-rose-400 flex items-center justify-center transition-all shadow-lg disabled:opacity-40" aria-label={`Pass on ${currentMedia.title}`} title="Pass (Left Arrow)"><X className="w-6 h-6" /></button>
          <button onClick={() => void handleUndo()} disabled={!undoAvailable || savingDecision} className="w-11 h-11 rounded-full bg-[#10283F]/70 border border-[#D9B66F]/40 hover:bg-[#10283F] text-[#D9B66F] flex items-center justify-center transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Undo last swipe" title="Undo (Ctrl+Z)"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={() => void handleDecision('interested')} disabled={savingDecision} className="w-14 h-14 rounded-full bg-[#10283F]/70 border border-emerald-500/50 hover:bg-emerald-950/60 hover:border-emerald-500 text-emerald-400 flex items-center justify-center transition-all shadow-lg disabled:opacity-40" aria-label={`Save ${currentMedia.title} to your library`} title="Interested (Right Arrow)"><Heart className="w-6 h-6 fill-emerald-400/20" /></button>
        </div>
      )}
    </div>
  );
};
