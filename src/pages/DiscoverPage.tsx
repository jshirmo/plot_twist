import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MoodSettings, MediaType, SavedMediaItem } from '../types';
import { getUserRatingFeedback, saveMediaItem } from '../lib/mediaService';
import { Sparkles, Sliders, Film, Tv, BookOpen, Radio, Bookmark, Check, Info, Clock, AlertCircle } from 'lucide-react';

interface RecommendationCardItem {
  id: string;
  catalogId: string;
  title: string;
  mediaType: MediaType;
  creator: string;
  releaseYear: string;
  posterUrl: string;
  genres: string[];
  runtimeMinutes?: number;
  overview: string;
  streamingProviders?: string[];
  compatibilityScore: number;
  aiExplanation: string;
}

export const DiscoverPage: React.FC = () => {
  const { user, userProfile, signIn } = useAuth();

  // Mood Sliders (1-5)
  const [mood, setMood] = useState<MoodSettings>({
    darkness: 3,
    romance: 2,
    suspense: 4,
    plotTwists: 5,
    emotionalIntensity: 4,
  });

  // Media Formats
  const [selectedFormats, setSelectedFormats] = useState<MediaType[]>([
    'movie', 'tv', 'book', 'podcast'
  ]);

  // Duration Filter
  const [durationLimit, setDurationLimit] = useState<number>(0); // 0 = no limit

  // Streaming services filter
  const [selectedStreamers, setSelectedStreamers] = useState<string[]>([]);

  // Results State
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationCardItem[]>([]);
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [selectedDetail, setSelectedDetail] = useState<RecommendationCardItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const toggleFormat = (format: MediaType) => {
    if (selectedFormats.includes(format)) {
      if (selectedFormats.length > 1) {
        setSelectedFormats(selectedFormats.filter((f) => f !== format));
      }
    } else {
      setSelectedFormats([...selectedFormats, format]);
    }
  };

  const toggleStreamer = (streamer: string) => {
    if (selectedStreamers.includes(streamer)) {
      setSelectedStreamers(selectedStreamers.filter((s) => s !== streamer));
    } else {
      setSelectedStreamers([...selectedStreamers, streamer]);
    }
  };

  const handleFindPlotTwist = async () => {
    setLoading(true);
    setStatusMessage(null);
    setRecommendations([]);

    try {
      const ratingFeedback = user ? await getUserRatingFeedback(user.uid) : undefined;
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodSettings: mood,
          tasteProfile: userProfile?.tasteProfile,
          ratingFeedback,
          formats: selectedFormats,
          maxDurationMinutes: durationLimit > 0 ? durationLimit : undefined,
          streamingServices: selectedStreamers.length > 0 ? selectedStreamers : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];
      setRecommendations(results);
      if (results.length === 0) setStatusMessage('No titles match these filters. Try expanding your search.');
    } catch (err) {
      console.error('Failed to get recommendations:', err);
      setStatusMessage('Failed to fetch recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToLibrary = async (item: RecommendationCardItem) => {
    if (!user) {
      signIn().catch(console.error);
      return;
    }

    try {
      await saveMediaItem({
        mediaId: item.id,
        mediaType: item.mediaType,
        title: item.title,
        posterUrl: item.posterUrl,
        creator: item.creator,
        releaseYear: item.releaseYear,
        genres: item.genres,
        status: 'watchlist',
        source: item.mediaType === 'book' ? 'google_books' : item.mediaType === 'podcast' ? 'podcast' : 'tmdb',
        runtimeMinutes: item.runtimeMinutes,
        streamingProviders: item.streamingProviders,
        overview: item.overview,
        aiExplanation: item.aiExplanation,
        compatibilityScore: item.compatibilityScore,
      });

      setSavedIds((prev) => ({ ...prev, [item.id]: true }));
    } catch (err) {
      console.error('Error saving item:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Page Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#10283F] border border-[#D9B66F]/40 rounded-full text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
          <Sliders className="w-3.5 h-3.5" />
          <span>Interactive Mood Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[#F7F2E9]">
          What Are You in the Mood For?
        </h1>
        <p className="text-sm text-[#F7F2E9]/70 max-w-xl mx-auto">
          Adjust the sliders below to dial in your emotional frequency. Our AI pairs your current mood with your personal taste.
        </p>
      </div>

      {/* Control Panel: Mood Sliders & Filters */}
      <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 sm:p-8 space-y-8 backdrop-blur-sm shadow-xl">
        {/* Five Mood Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Darkness */}
          <div className="space-y-2 bg-[#091A2B]/60 p-4 rounded-xl border border-[#10283F]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#F7F2E9]">Darkness</span>
              <span className="text-[#D9B66F]">Level {mood.darkness} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mood.darkness}
              onChange={(e) => setMood({ ...mood, darkness: Number(e.target.value) })}
              className="w-full accent-[#D9B66F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#F7F2E9]/50">
              <span>Light & uplifting</span>
              <span>Dark & intense</span>
            </div>
          </div>

          {/* Romance */}
          <div className="space-y-2 bg-[#091A2B]/60 p-4 rounded-xl border border-[#10283F]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#F7F2E9]">Romance</span>
              <span className="text-[#D9B66F]">Level {mood.romance} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mood.romance}
              onChange={(e) => setMood({ ...mood, romance: Number(e.target.value) })}
              className="w-full accent-[#D9B66F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#F7F2E9]/50">
              <span>No romance</span>
              <span>Romance-heavy</span>
            </div>
          </div>

          {/* Suspense */}
          <div className="space-y-2 bg-[#091A2B]/60 p-4 rounded-xl border border-[#10283F]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#F7F2E9]">Suspense</span>
              <span className="text-[#D9B66F]">Level {mood.suspense} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mood.suspense}
              onChange={(e) => setMood({ ...mood, suspense: Number(e.target.value) })}
              className="w-full accent-[#D9B66F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#F7F2E9]/50">
              <span>Relaxed & calm</span>
              <span>Extremely suspenseful</span>
            </div>
          </div>

          {/* Plot Twists */}
          <div className="space-y-2 bg-[#091A2B]/60 p-4 rounded-xl border border-[#10283F]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#F7F2E9]">Plot Twists</span>
              <span className="text-[#D9B66F]">Level {mood.plotTwists} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mood.plotTwists}
              onChange={(e) => setMood({ ...mood, plotTwists: Number(e.target.value) })}
              className="w-full accent-[#D9B66F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#F7F2E9]/50">
              <span>Straightforward</span>
              <span>Mind-bending surprises</span>
            </div>
          </div>

          {/* Emotional Intensity */}
          <div className="space-y-2 bg-[#091A2B]/60 p-4 rounded-xl border border-[#10283F]">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-[#F7F2E9]">Emotional Intensity</span>
              <span className="text-[#D9B66F]">Level {mood.emotionalIntensity} / 5</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mood.emotionalIntensity}
              onChange={(e) => setMood({ ...mood, emotionalIntensity: Number(e.target.value) })}
              className="w-full accent-[#D9B66F] cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-[#F7F2E9]/50">
              <span>Comforting & easy</span>
              <span>Emotionally intense</span>
            </div>
          </div>
        </div>

        {/* Media Formats & Filters */}
        <div className="pt-4 border-t border-[#10283F] flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          {/* Format selection */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F] block">
              Media Formats
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'movie' as MediaType, label: 'Movies', icon: Film },
                { id: 'tv' as MediaType, label: 'TV Shows', icon: Tv },
                { id: 'book' as MediaType, label: 'Books', icon: BookOpen },
                { id: 'podcast' as MediaType, label: 'Podcasts', icon: Radio },
              ].map((fmt) => {
                const Icon = fmt.icon;
                const active = selectedFormats.includes(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    onClick={() => toggleFormat(fmt.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/60 hover:text-[#F7F2E9]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{fmt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration selection */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F] block">
              Available Time
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { limit: 30, label: '< 30m' },
                { limit: 60, label: '< 1h' },
                { limit: 120, label: '< 2h' },
                { limit: 180, label: '< 3h' },
                { limit: 0, label: 'No Limit' },
              ].map((d) => (
                <button
                  key={d.limit}
                  onClick={() => setDurationLimit(d.limit)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    durationLimit === d.limit
                      ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                      : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/60 hover:text-[#F7F2E9]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Streaming Service Filter */}
        <div className="pt-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F] block mb-2">
            Streaming Providers (Optional)
          </span>
          <div className="flex flex-wrap gap-2">
            {['Netflix', 'Amazon Prime Video', 'Max', 'Hulu', 'Apple TV+', 'Disney+', 'Paramount+', 'Spotify'].map(
              (svc) => {
                const active = selectedStreamers.includes(svc);
                return (
                  <button
                    key={svc}
                    onClick={() => toggleStreamer(svc)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/60 hover:text-[#F7F2E9]'
                    }`}
                  >
                    {svc}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Find Button */}
        <div className="pt-4 flex justify-center">
          <button
            onClick={handleFindPlotTwist}
            disabled={loading}
            className="px-10 py-4 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-bold text-sm uppercase tracking-wider rounded-xl shadow-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>{loading ? 'Consulting Gemini AI...' : 'Find My Plot Twist'}</span>
          </button>
        </div>
      </div>

      {/* Error / Status Message */}
      {statusMessage && (
        <div className="p-4 bg-red-950/40 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Recommendations Grid */}
      {recommendations.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#10283F] pb-4">
            <h2 className="text-2xl font-serif font-bold text-[#F7F2E9]">
              Curated For Your Current Mood
            </h2>
            <span className="text-xs text-[#F7F2E9]/60 font-mono">
              {recommendations.length} Verified Titles
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map((item) => {
              const isSaved = savedIds[item.id];
              return (
                <div
                  key={item.id}
                  className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl overflow-hidden flex flex-col hover:border-[#D9B66F]/40 transition-all group"
                >
                  {/* Poster / Artwork Header */}
                  <div className="relative h-64 w-full bg-[#091A2B] overflow-hidden">
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#091A2B] via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 bg-[#091A2B]/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#D9B66F] border border-[#10283F]">
                      {item.compatibilityScore}% Plot Twist Match
                    </div>
                    <div className="absolute top-3 right-3 bg-[#091A2B]/80 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] uppercase tracking-wider font-semibold text-[#F7F2E9]/80 border border-[#10283F]">
                      {item.mediaType}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-serif font-bold text-lg text-[#F7F2E9] group-hover:text-[#D9B66F] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <span className="text-xs text-[#F7F2E9]/50 tabular-nums">
                          {item.releaseYear}
                        </span>
                      </div>

                      {/* Clean Unboxed Metadata */}
                      <div className="flex items-center gap-1.5 text-xs text-[#F7F2E9]/60">
                        <span>{item.creator}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.genres.slice(0, 2).join(', ')}</span>
                        {item.runtimeMinutes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.runtimeMinutes}m</span>
                          </>
                        )}
                      </div>

                      <p className="text-xs text-[#F7F2E9]/70 line-clamp-2 leading-relaxed pt-1">
                        {item.overview}
                      </p>

                      {/* AI Reasoning Box */}
                      <div className="bg-[#10283F]/60 border border-[#D9B66F]/20 rounded-xl p-3 text-xs text-[#D9B66F] space-y-1">
                        <span className="font-semibold uppercase tracking-wider text-[10px] text-[#F7F2E9]/60 block">
                          Why this matches your plot:
                        </span>
                        <p className="text-xs leading-relaxed italic">
                          "{item.aiExplanation}"
                        </p>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-[#10283F]">
                      <button
                        onClick={() => setSelectedDetail(item)}
                        className="text-xs font-medium text-[#F7F2E9]/60 hover:text-[#F7F2E9] flex items-center gap-1 cursor-pointer"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>

                      <button
                        onClick={() => handleSaveToLibrary(item)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          isSaved
                            ? 'bg-[#2C7A7B] text-white'
                            : 'bg-[#10283F] text-[#D9B66F] hover:bg-[#D9B66F] hover:text-[#091A2B]'
                        }`}
                      >
                        {isSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                        <span>{isSaved ? 'Saved to Library' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#091A2B] border border-[#10283F] rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
                  {selectedDetail.mediaType} · {selectedDetail.releaseYear}
                </span>
                <h3 className="text-2xl font-serif font-bold text-[#F7F2E9]">
                  {selectedDetail.title}
                </h3>
                <span className="text-xs text-[#F7F2E9]/60">Created by {selectedDetail.creator}</span>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="text-[#F7F2E9]/60 hover:text-[#F7F2E9] text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden h-48 bg-[#10283F]">
              <img
                src={selectedDetail.posterUrl}
                alt={selectedDetail.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">Overview</h4>
              <p className="text-sm text-[#F7F2E9]/80 leading-relaxed">{selectedDetail.overview}</p>
            </div>

            {selectedDetail.streamingProviders && selectedDetail.streamingProviders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
                  Available On
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedDetail.streamingProviders.map((prov) => (
                    <span
                      key={prov}
                      className="px-2.5 py-1 bg-[#10283F] border border-[#10283F] rounded-md text-xs text-[#F7F2E9]"
                    >
                      {prov}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#10283F] flex justify-end">
              <button
                onClick={() => {
                  handleSaveToLibrary(selectedDetail);
                  setSelectedDetail(null);
                }}
                className="px-5 py-2.5 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-lg"
              >
                Save to Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
