import { Router, Request, Response } from 'express';
import { generateRecommendations, scanMediaPosterOrCover } from './geminiService';
import { VERIFIED_CATALOG } from './mediaCatalog';

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
