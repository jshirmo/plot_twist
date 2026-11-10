import { Router, Request, Response } from 'express';
import { generateRecommendations, scanMediaPosterOrCover } from './geminiService';
import { VERIFIED_CATALOG } from './mediaCatalog';
import { searchPodcasts, getTrendingPodcasts, getPodcastEpisodes, podcastSource } from './podcastService';
import { getLiveEvents, getNearbyBookstores, localServiceStatus, type LocationQuery } from './localService';

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
    });

    return res.json({ results });
  } catch (error) {
    console.error('API /recommendations error:', error);
    return res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Endpoint for Movie Swipe Deck
apiRouter.post('/swipe-deck', async (req: Request, res: Response) => {
  try {
    const { excludedMediaIds, tasteProfile } = req.body;

    const movieCandidates = VERIFIED_CATALOG.filter(
      (m) => m.mediaType === 'movie' && (!excludedMediaIds || !excludedMediaIds.includes(m.id))
    );

    const deck = movieCandidates.map((m) => ({
      id: m.id,
      title: m.title,
      releaseYear: m.releaseYear,
      posterUrl: m.posterUrl,
      genres: m.genres,
      runtimeMinutes: m.runtimeMinutes,
      overview: m.overview,
      aiExplanation: `Recommended for you based on your interest in ${m.genres.slice(0, 2).join(' & ')}.`,
      compatibilityScore: 88,
      streamingProviders: m.streamingProviders,
      director: m.creator,
    }));

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

    const recognition = await scanMediaPosterOrCover(imageBase64, mimeType || 'image/jpeg');

    // Find any catalog match or format response
    const catalogMatch = VERIFIED_CATALOG.find(
      (c) => c.title.toLowerCase() === recognition.title?.toLowerCase()
    );

    const compatibilityScore = catalogMatch ? 92 : 84;
    const explanation = catalogMatch
      ? `Recognized '${catalogMatch.title}'. This fits your profile with its notable plot twists and depth.`
      : `Recognized '${recognition.title || 'Media Title'}'. High compatibility with your preferred genres.`;

    return res.json({
      recognized: recognition,
      catalogMatch: catalogMatch || null,
      compatibilityScore,
      aiExplanation: explanation,
    });
  } catch (error) {
    console.error('API /scan error:', error);
    return res.status(500).json({ error: 'Failed to scan image' });
  }
});

// Endpoint to search or browse catalog
apiRouter.get('/catalog', (_req: Request, res: Response) => {
  return res.json({ catalog: VERIFIED_CATALOG });
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
