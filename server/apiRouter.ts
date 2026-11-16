import { Router, Request, Response } from 'express';
import { generateRecommendations, scanMediaPosterOrCover } from './geminiService';
import { parseRatingFeedback } from './ratingFeedback';
import { loadCatalog, VERIFIED_CATALOG } from './mediaCatalog';
import { searchPodcasts, getTrendingPodcasts, getPodcastEpisodes, podcastSource } from './podcastService';
import { getLiveEvents, getNearbyBookstores, localServiceStatus, type LocationQuery } from './localService';
import type { MediaType, MoodSettings, TasteProfile } from '../src/types';

export const apiRouter = Router();

// Endpoint for AI Recommendations
apiRouter.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { moodSettings, tasteProfile, formats, maxDurationMinutes, streamingServices, excludedMediaIds } = req.body;

    if (!moodSettings) {
      return res.status(400).json({ error: 'moodSettings are required' });
    }

    // Swipe history is the durable learning record. We derive its scores for each
    // request instead of storing a second mutable aggregate, so Undo immediately
    // removes its influence from both local and Gemini-powered recommendations.
    const swipeFeedback = readSwipeFeedback(req.body.swipeHistory);
    const swipeTaste = deriveSwipeTaste(swipeFeedback);
    const effectiveTasteProfile = createSwipeAwareTasteProfile(tasteProfile, swipeTaste);
    const inferredFormats = swipeTaste.topFormats.length ? swipeTaste.topFormats : undefined;

    const results = await generateRecommendations({
      moodSettings,
      tasteProfile: effectiveTasteProfile,
      // Explicit filters always win. Inferred formats make a first request dynamic
      // when the caller has not supplied a format filter.
      formats: Array.isArray(formats) && formats.length ? formats : inferredFormats,
      maxDurationMinutes,
      streamingServices,
      excludedMediaIds,
      ratingFeedback: parseRatingFeedback(req.body.ratingFeedback),
    });

    return res.json({ results });
  } catch (error) {
    console.error('API /recommendations error:', error);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

const swipeFormats: MediaType[] = ['movie', 'tv', 'book', 'podcast'];

interface ScanRecognition {
  title?: string;
  creator?: string;
  mediaType?: MediaType;
  genres?: string[];
  summary?: string;
  confidence?: number;
}

interface SwipeFeedback {
  mediaId: string;
  mediaType: MediaType;
  decision: 'interested' | 'pass';
  feedbackStatus: 'active' | 'reversed';
  genres: string[];
  moodTags?: MoodSettings;
  createdAt?: string;
}

export interface SwipeTasteSignals {
  formatScores: Record<MediaType, number>;
  genreScores: Record<string, number>;
  topFormats: MediaType[];
  topGenres: string[];
  avoidedGenres: string[];
  summary: string;
}

function isMediaType(value: unknown): value is MediaType {
  return typeof value === 'string' && swipeFormats.includes(value as MediaType);
}

function readMoodTags(value: unknown): MoodSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const read = (key: keyof MoodSettings) => {
    const score = candidate[key];
    return typeof score === 'number' && Number.isFinite(score)
      ? Math.max(1, Math.min(5, score))
      : undefined;
  };
  const darkness = read('darkness');
  const romance = read('romance');
  const suspense = read('suspense');
  const plotTwists = read('plotTwists');
  const emotionalIntensity = read('emotionalIntensity');
  return darkness === undefined || romance === undefined || suspense === undefined ||
    plotTwists === undefined || emotionalIntensity === undefined
    ? undefined
    : { darkness, romance, suspense, plotTwists, emotionalIntensity };
}

function readSwipeFeedback(value: unknown): SwipeFeedback[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry): SwipeFeedback[] => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Record<string, unknown>;
    if (!isMediaType(candidate.mediaType) ||
      typeof candidate.mediaId !== 'string' ||
      (candidate.decision !== 'interested' && candidate.decision !== 'pass') ||
      candidate.feedbackStatus !== 'active') return [];

    return [{
      mediaId: candidate.mediaId,
      mediaType: candidate.mediaType,
      decision: candidate.decision,
      feedbackStatus: 'active',
      genres: Array.isArray(candidate.genres)
        ? candidate.genres.filter((genre): genre is string => typeof genre === 'string')
        : [],
      moodTags: readMoodTags(candidate.moodTags),
      createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : undefined,
    }];
  });
}

const emptyFormatScores = (): Record<MediaType, number> => ({
  movie: 0,
  tv: 0,
  book: 0,
  podcast: 0,
});

function signalWeight(swipe: SwipeFeedback, newestSwipeAt: number) {
  const timestamp = swipe.createdAt ? Date.parse(swipe.createdAt) : NaN;
  if (!Number.isFinite(timestamp) || !Number.isFinite(newestSwipeAt)) return 1;
  // Older feedback still matters, but recent choices have more influence. The
  // floor prevents a long-time user's early preferences from disappearing.
  const ageDays = Math.max(0, (newestSwipeAt - timestamp) / 86_400_000);
  return Math.max(0.35, Math.exp(-ageDays / 120));
}

/**
 * Builds live preference scores from immutable swipe decisions. The history is
 * the source of truth: a reversed decision is not sent here, so Undo naturally
 * recalculates every score without compensating writes.
 */
export function deriveSwipeTaste(feedback: SwipeFeedback[]): SwipeTasteSignals {
  const formatScores = emptyFormatScores();
  const genreTotals = new Map<string, { label: string; score: number }>();
  const newestSwipeAt = Math.max(...feedback.map((swipe) => Date.parse(swipe.createdAt ?? '')).filter(Number.isFinite), NaN);

  for (const swipe of feedback) {
    const weight = signalWeight(swipe, newestSwipeAt);
    const decisionScore = (swipe.decision === 'interested' ? 4 : -3) * weight;
    formatScores[swipe.mediaType] += decisionScore;
    for (const rawGenre of swipe.genres) {
      const label = rawGenre.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const current = genreTotals.get(key) ?? { label, score: 0 };
      current.score += decisionScore;
      genreTotals.set(key, current);
    }
  }

  const rankedFormats = [...swipeFormats].sort((left, right) =>
    formatScores[right] - formatScores[left] || left.localeCompare(right),
  );
  const rankedGenres = [...genreTotals.values()].sort((left, right) =>
    right.score - left.score || left.label.localeCompare(right.label),
  );
  const topFormats = rankedFormats.filter((format) => formatScores[format] > 0);
  const topGenres = rankedGenres.filter((genre) => genre.score > 0).map((genre) => genre.label).slice(0, 6);
  const avoidedGenres = rankedGenres.filter((genre) => genre.score < 0).map((genre) => genre.label).slice(0, 6);
  // Use normalized keys for comparisons with catalog data. Titles can use
  // different capitalization for the same genre (for example, "Mystery" vs
  // "mystery"), while the labels above remain friendly for the UI and Gemini.
  const genreScores = Object.fromEntries(rankedGenres.map((genre) => [
    genre.label.toLowerCase(),
    Math.round(genre.score * 100) / 100,
  ]));
  const formatLabel = topFormats.length ? topFormats.slice(0, 2).join(' and ') : 'all formats';
  const genreLabel = topGenres.length ? topGenres.slice(0, 3).join(', ') : 'new stories';
  const avoidedLabel = avoidedGenres.length ? ` while lowering ${avoidedGenres.slice(0, 2).join(' and ')}` : '';

  return {
    formatScores: Object.fromEntries(
      swipeFormats.map((format) => [format, Math.round(formatScores[format] * 100) / 100]),
    ) as Record<MediaType, number>,
    genreScores,
    topFormats,
    topGenres,
    avoidedGenres,
    summary: feedback.length
      ? `Recent swipes favor ${genreLabel} in ${formatLabel}${avoidedLabel}.`
      : 'Swipe a few titles to teach your recommendations.',
  };
}

function uniqueLabels(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function createSwipeAwareTasteProfile(
  tasteProfile: TasteProfile | undefined,
  swipeTaste: SwipeTasteSignals,
): TasteProfile | undefined {
  if (!tasteProfile && swipeTaste.topGenres.length === 0 && swipeTaste.topFormats.length === 0) return undefined;
  const base: TasteProfile = tasteProfile ?? {
    preferredGenres: [],
    preferredFormats: [],
    favoriteStories: [],
    storyElements: [],
    dislikedGenres: [],
    timeAvailability: '',
    streamingServices: [],
  };
  return {
    ...base,
    // Preserve explicit onboarding choices while letting fresh swipe evidence
    // lead Gemini and the local fallback ranking.
    preferredGenres: uniqueLabels([...swipeTaste.topGenres, ...base.preferredGenres]),
    preferredFormats: swipeTaste.topFormats.length ? swipeTaste.topFormats : base.preferredFormats,
    dislikedGenres: uniqueLabels([...base.dislikedGenres, ...swipeTaste.avoidedGenres]),
    aiTasteSummary: [base.aiTasteSummary, swipeTaste.summary].filter(Boolean).join(' '),
  };
}

function sharedGenreCount(a: string[], b: string[]) {
  const left = new Set(a.map((genre) => genre.trim().toLowerCase()).filter(Boolean));
  const right = new Set(b.map((genre) => genre.trim().toLowerCase()).filter(Boolean));
  return [...left].filter((genre) => right.has(genre)).length;
}

function moodSimilarity(a: MoodSettings, b?: MoodSettings) {
  if (!b) return 0;
  const keys: Array<keyof MoodSettings> = ['darkness', 'romance', 'suspense', 'plotTwists', 'emotionalIntensity'];
  const distance = keys.reduce((sum, key) => sum + Math.abs(a[key] - b[key]), 0);
  return Math.max(0, 5 - distance / keys.length);
}

function seededTieBreaker(id: string, seed: number) {
  let hash = (seed >>> 0) || 1;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0x45d9f3b) >>> 0;
  }
  return hash;
}

export function rankSwipeDeck(
  candidates: Awaited<ReturnType<typeof loadCatalog>>,
  feedback: SwipeFeedback[],
  tasteProfile?: TasteProfile,
  deckSeed = 1,
) {
  const swipeTaste = deriveSwipeTaste(feedback);
  const newestSwipeAt = Math.max(
    ...feedback.map((swipe) => Date.parse(swipe.createdAt ?? '')).filter(Number.isFinite),
    NaN,
  );
  // Average the feedback signals so a longer history keeps teaching the deck
  // instead of pushing every card to the score ceiling.
  const feedbackCount = Math.max(1, feedback.length);
  return candidates.map((candidate) => {
    const preferredGenreBoost = sharedGenreCount(candidate.genres, tasteProfile?.preferredGenres ?? []) * 3;
    const feedbackAdjustment = feedback.reduce((total, swipe) => {
      const similarity = sharedGenreCount(candidate.genres, swipe.genres) * 6
        + moodSimilarity(candidate.moodTags, swipe.moodTags) * 2;
      const direction = swipe.decision === 'interested' ? 1 : -1;
      return total + direction * similarity * signalWeight(swipe, newestSwipeAt);
    }, 0) / feedbackCount;
    const genreScore = (genre: string) => swipeTaste.genreScores[genre.trim().toLowerCase()] ?? 0;
    const genreSignal = candidate.genres.reduce((total, genre) => total + genreScore(genre), 0)
      / feedbackCount * 1.5;
    const formatSignal = swipeTaste.formatScores[candidate.mediaType] / feedbackCount * 1.25;
    const score = Math.max(60, Math.min(99, Math.round(80 + preferredGenreBoost + feedbackAdjustment + genreSignal + formatSignal)));
    const preferredGenre = candidate.genres.find((genre) => genreScore(genre) > 0);
    const avoidedGenre = candidate.genres.find((genre) => genreScore(genre) < 0);
    const feedbackReason = preferredGenre
      ? `Your swipes are trending toward ${preferredGenre}, so this moved up.`
      : avoidedGenre
        ? `Kept lower because your swipes point away from ${avoidedGenre}.`
      : `Recommended for its ${candidate.genres.slice(0, 2).join(' and ') || 'storytelling'}.`;

    return {
      id: candidate.id,
      mediaType: candidate.mediaType,
      title: candidate.title,
      releaseYear: candidate.releaseYear,
      posterUrl: candidate.posterUrl,
      genres: candidate.genres,
      pageCount: candidate.pageCount,
      runtimeMinutes: candidate.runtimeMinutes,
      overview: candidate.overview,
      aiExplanation: feedbackReason,
      compatibilityScore: score,
      streamingProviders: candidate.streamingProviders,
      director: candidate.creator,
      moodTags: candidate.moodTags,
    };
  }).sort((a, b) =>
    b.compatibilityScore - a.compatibilityScore ||
    seededTieBreaker(a.id, deckSeed) - seededTieBreaker(b.id, deckSeed)
  );
}

function asPercent(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function compactText(value: unknown, maximum = 180) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maximum) : '';
}

export function describeScanMatch(recognition: ScanRecognition, tasteProfile?: TasteProfile) {
  const summary = compactText(recognition.summary);
  const recognizedGenres = recognition.genres ?? [];
  const matchingGenres = recognizedGenres.filter((genre) => tasteProfile?.preferredGenres?.some(
    (preferred) => preferred.toLowerCase() === genre.toLowerCase(),
  ));
  if (matchingGenres.length) {
    return `It shares your interest in ${matchingGenres.slice(0, 2).join(' and ')}. ${summary}`.trim();
  }
  return summary || `Recognized from the cover artwork and title details.`;
}

// Endpoint for the four-format swipe deck
apiRouter.post('/swipe-deck', async (req: Request, res: Response) => {
  try {
    const mediaType = isMediaType(req.body.mediaType) ? req.body.mediaType : 'movie';
    const excludedMediaIds = Array.isArray(req.body.excludedMediaIds)
      ? req.body.excludedMediaIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    const tasteProfile = req.body.tasteProfile as TasteProfile | undefined;
    const feedback = readSwipeFeedback(req.body.swipeHistory);
    const swipeTaste = deriveSwipeTaste(feedback);
    const effectiveTasteProfile = createSwipeAwareTasteProfile(tasteProfile, swipeTaste);
    const deckSeed = typeof req.body.deckSeed === 'number' && Number.isFinite(req.body.deckSeed)
      ? req.body.deckSeed
      : 1;
    const catalog = await loadCatalog({
      formats: [mediaType],
      preferredGenres: effectiveTasteProfile?.preferredGenres,
    });
    const deck = rankSwipeDeck(
      catalog.filter((item) => !excludedMediaIds.includes(item.id)),
      feedback,
      effectiveTasteProfile,
      deckSeed,
    );

    return res.json({ deck, tasteSignals: swipeTaste });
  } catch (error) {
    console.error('API /swipe-deck error:', error);
    return res.status(500).json({ error: 'Failed to get swipe deck' });
  }
});

// Endpoint for Camera / Poster Scanning
apiRouter.post('/scan', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, tasteProfile } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const scanned = await scanMediaPosterOrCover(imageBase64, mimeType || 'image/jpeg') as ScanRecognition;
    const recognition: ScanRecognition = {
      ...scanned,
      mediaType: isMediaType(scanned.mediaType) ? scanned.mediaType : undefined,
      genres: Array.isArray(scanned.genres)
        ? scanned.genres.filter((genre): genre is string => typeof genre === 'string').slice(0, 10)
        : [],
      confidence: asPercent(scanned.confidence),
    };

    // A title can exist in more than one format, so preserve the detected format.
    const catalogMatch = VERIFIED_CATALOG.find(
      (c) => c.mediaType === recognition.mediaType && c.title.toLowerCase() === recognition.title?.toLowerCase()
    );

    const matchPercent = asPercent(recognition.confidence);
    const matchingGenres = (recognition.genres ?? []).filter((genre) =>
      tasteProfile?.preferredGenres?.some((preferred: string) => preferred.toLowerCase() === genre.toLowerCase()),
    ).length;
    const compatibilityScore = Math.max(50, Math.min(99, 70 + matchingGenres * 10));
    const explanation = describeScanMatch(recognition, tasteProfile);

    return res.json({
      recognized: recognition,
      catalogMatch: catalogMatch || null,
      matchPercent,
      compatibilityScore,
      why: explanation,
      aiExplanation: explanation,
    });
  } catch (error) {
    console.error('API /scan error:', error instanceof Error ? error.name : 'Unknown error');
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'scanner_not_configured', message: 'The scanner is not configured. Please contact the app administrator.' });
    }
    return res.status(502).json({ error: 'scanner_unavailable', message: 'The AI scanner is temporarily unavailable. Please try again.' });
  }
});

// Endpoint to search or browse catalog
apiRouter.get('/catalog', async (req: Request, res: Response) => {
  const search = typeof req.query.q === 'string' ? req.query.q : undefined;
  const formats = typeof req.query.format === 'string' ? req.query.format.split(',') : undefined;
  const catalog = await loadCatalog({ search, formats });
  return res.json({ catalog });
});

// ---------------------------------------------------------------------------
// Podcasts & Near You (owner: Chloe). Code lives in podcastService.ts / localService.ts.
// ---------------------------------------------------------------------------

const toInt = (value: unknown, fallback: number, max: number) => {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};

const cleanText = (value: unknown, maxLength = 100) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, maxLength) : '';

function readLocation(query: Request['query']): LocationQuery {
  const lat = query.lat !== undefined ? Number(query.lat) : undefined;
  const lng = query.lng !== undefined ? Number(query.lng) : undefined;
  return { lat, lng, city: cleanText(query.city, 80) || undefined };
}

function localError(res: Response, error: unknown, label: string) {
  const message = (error as Error).message;
  if (message === 'not_configured') {
    return res.status(503).json({ error: 'not_configured', message: `${label} aren't set up yet (missing API key).` });
  }
  if (message === 'location_required') {
    return res.status(400).json({ error: 'location_required', message: 'Share your location or enter a city.' });
  }
  console.error(`API ${label} error:`, message);
  return res.status(502).json({ error: 'upstream_failed', message: `Couldn't load ${label.toLowerCase()} right now. Try again in a minute.` });
}

// Search podcasts: GET /api/podcasts/search?q=true+crime&max=20
apiRouter.get('/podcasts/search', async (req: Request, res: Response) => {
  const q = cleanText(req.query.q);
  const results = await searchPodcasts(q, toInt(req.query.max, 20, 40));
  return res.json({ results, source: podcastSource() });
});

// Trending podcasts: GET /api/podcasts/trending?max=20&category=True%20Crime
apiRouter.get('/podcasts/trending', async (req: Request, res: Response) => {
  const results = await getTrendingPodcasts(toInt(req.query.max, 20, 40), cleanText(req.query.category, 60) || undefined);
  return res.json({ results, source: podcastSource() });
});

// Latest episodes for a podcast: GET /api/podcasts/123456/episodes?max=10
apiRouter.get('/podcasts/:feedId/episodes', async (req: Request, res: Response) => {
  const episodes = await getPodcastEpisodes(String(req.params.feedId), toInt(req.query.max, 10, 50));
  return res.json({ episodes });
});

// Which Near You sources are set up: GET /api/local/status
apiRouter.get('/local/status', (_req: Request, res: Response) => {
  return res.json(localServiceStatus());
});

// Live podcast shows nearby: GET /api/local/events?lat=..&lng=.. (or ?city=New%20Orleans)&podcasts=Serial|Morbid
apiRouter.get('/local/events', async (req: Request, res: Response) => {
  try {
    const podcasts = cleanText(req.query.podcasts, 500).split('|').map((t) => t.trim()).filter(Boolean);
    const { events, fallback } = await getLiveEvents(readLocation(req.query), podcasts);
    return res.json({ events, fallback });
  } catch (error) {
    return localError(res, error, 'Live shows');
  }
});

// Bookstores nearby: GET /api/local/bookstores?lat=..&lng=.. (or ?city=New%20Orleans)
apiRouter.get('/local/bookstores', async (req: Request, res: Response) => {
  try {
    const bookstores = await getNearbyBookstores(readLocation(req.query));
    return res.json({ bookstores });
  } catch (error) {
    return localError(res, error, 'Bookstores');
  }
});
