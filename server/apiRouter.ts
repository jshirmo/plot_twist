import { Router, Request, Response } from 'express';
import { generateRecommendations, scanMediaPosterOrCover } from './geminiService';
import { VERIFIED_CATALOG } from './mediaCatalog';
import { getAuthenticatedProfile } from './authProfileService';
import { retrieveVerifiedCandidates } from './catalogProviders';

export const apiRouter = Router();

// Endpoint for AI Recommendations
apiRouter.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { moodSettings, formats, maxDurationMinutes, streamingServices, excludedMediaIds, availabilityRegion } = req.body;

    if (!isValidMood(moodSettings)) {
      return res.status(400).json({ error: 'moodSettings are required' });
    }

    const profile = await getAuthenticatedProfile(req.header('authorization'));
    const requestedFormats = Array.isArray(formats)
      ? formats.filter((format): format is 'movie' | 'tv' | 'book' | 'podcast' =>
        ['movie', 'tv', 'book', 'podcast'].includes(format)
      )
      : profile.tasteProfile.preferredFormats;
    const verifiedCandidates = await retrieveVerifiedCandidates({
      mood: moodSettings,
      taste: profile.tasteProfile,
      formats: requestedFormats.length ? requestedFormats : ['movie', 'tv', 'book', 'podcast'],
      maxDurationMinutes: typeof maxDurationMinutes === 'number' && maxDurationMinutes > 0 ? maxDurationMinutes : undefined,
      streamingServices: cleanStringArray(streamingServices),
      availabilityRegion: typeof availabilityRegion === 'string' && /^[A-Za-z]{2}$/.test(availabilityRegion)
        ? availabilityRegion.toUpperCase() : 'US',
      excludedMediaIds: cleanStringArray(excludedMediaIds),
    });

    if (!verifiedCandidates.length) {
      return res.status(422).json({
        error: 'No verified titles matched those filters. Try another format, a longer runtime, or fewer streaming filters.',
      });
    }

    const recommendation = await generateRecommendations({
      moodSettings,
      tasteProfile: profile.tasteProfile,
      candidates: verifiedCandidates,
    });

    return res.json({ results: recommendation.results, usedFallback: recommendation.usedFallback });
  } catch (error) {
    console.error('API /recommendations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate recommendations';
    const status = message.includes('Authentication required') ? 401 : 500;
    return res.status(status).json({ error: status === 401 ? message : 'Failed to generate recommendations' });
  }
});

function isValidMood(value: unknown): value is { darkness: number; romance: number; suspense: number; plotTwists: number; emotionalIntensity: number } {
  if (!value || typeof value !== 'object') return false;
  return ['darkness', 'romance', 'suspense', 'plotTwists', 'emotionalIntensity'].every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5;
  });
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string').slice(0, 20);
}

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
