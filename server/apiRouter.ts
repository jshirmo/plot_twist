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

    const results = await generateRecommendations({
      moodSettings,
      tasteProfile,
      formats,
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
  return value.flatMap((entry): SwipeFeedback[] => {
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
    }];
  });
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

export function rankSwipeDeck(
  candidates: Awaited<ReturnType<typeof loadCatalog>>,
  feedback: SwipeFeedback[],
  tasteProfile?: TasteProfile,
) {
  return candidates.map((candidate) => {
    const preferredGenreBoost = sharedGenreCount(candidate.genres, tasteProfile?.preferredGenres ?? []) * 3;
    const feedbackAdjustment = feedback.reduce((total, swipe) => {
      const similarity = sharedGenreCount(candidate.genres, swipe.genres) * 6
        + moodSimilarity(candidate.moodTags, swipe.moodTags) * 2;
      return total + (swipe.decision === 'interested' ? similarity : -similarity);
    }, 0);
    const score = Math.max(60, Math.min(99, Math.round(80 + preferredGenreBoost + feedbackAdjustment)));
    const matchingSwipe = feedback.find((swipe) => sharedGenreCount(candidate.genres, swipe.genres) > 0);
    const feedbackReason = matchingSwipe
      ? matchingSwipe.decision === 'interested'
        ? `Your interest in similar ${matchingSwipe.genres[0] || 'stories'} moves this up.`
        : `Kept lower because it is similar to a ${matchingSwipe.genres[0] || 'style'} you passed.`
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
  }).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
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
    const catalog = await loadCatalog({
      formats: [mediaType],
      preferredGenres: tasteProfile?.preferredGenres,
    });
    const deck = rankSwipeDeck(
      catalog.filter((item) => !excludedMediaIds.includes(item.id)),
      feedback,
      tasteProfile,
    );

    return res.json({ deck });
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
    console.error('API /scan error:', error);
    return res.status(500).json({ error: 'Failed to scan image' });
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
