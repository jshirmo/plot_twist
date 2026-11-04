import { GoogleGenAI, Type } from '@google/genai';
import { CatalogMediaItem, VERIFIED_CATALOG, getFilteredCatalogCandidates } from './mediaCatalog';
import { MoodSettings, TasteProfile } from '../src/types';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface RecommendationResult {
  catalogId: string;
  id: string;
  title: string;
  mediaType: string;
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

export async function generateRecommendations(params: {
  tasteProfile?: TasteProfile;
  moodSettings: MoodSettings;
  formats?: string[];
  maxDurationMinutes?: number;
  streamingServices?: string[];
  excludedMediaIds?: string[];
}): Promise<RecommendationResult[]> {
  // Step 1: Filter verified candidates strictly
  let candidates = getFilteredCatalogCandidates({
    formats: params.formats,
    maxDurationMinutes: params.maxDurationMinutes,
    streamingServices: params.streamingServices,
  });

  // Exclude already rejected or watched titles
  if (params.excludedMediaIds && params.excludedMediaIds.length > 0) {
    candidates = candidates.filter((c) => !params.excludedMediaIds!.includes(c.id));
  }

  if (candidates.length === 0) {
    // Fallback to all candidates if filters were too restrictive
    candidates = VERIFIED_CATALOG.filter((c) => !params.excludedMediaIds?.includes(c.id));
  }

  // If no Gemini key is provided, return smart rule-based ranking
  if (!process.env.GEMINI_API_KEY) {
    return rankCandidatesLocally(candidates, params.moodSettings, params.tasteProfile);
  }

  try {
    const candidateSummary = candidates.map((c) => ({
      id: c.id,
      title: c.title,
      mediaType: c.mediaType,
      creator: c.creator,
      genres: c.genres,
      overview: c.overview,
      moodTags: c.moodTags,
    }));

    const prompt = `You are the recommendation engine for Plot Twist, an entertainment platform combining Books, Movies, TV, and Podcasts.
Evaluate the candidate media titles below against the user's taste profile and current mood sliders.

Current Mood Sliders (1 to 5 scale):
- Darkness: ${params.moodSettings.darkness} (1=Light/uplifting, 5=Dark/intense)
- Romance: ${params.moodSettings.romance} (1=No romance, 5=Romance-heavy)
- Suspense: ${params.moodSettings.suspense} (1=Relaxed, 5=Extremely suspenseful)
- Plot Twists: ${params.moodSettings.plotTwists} (1=Straightforward, 5=Full of surprises)
- Emotional Intensity: ${params.moodSettings.emotionalIntensity} (1=Easygoing, 5=Deeply intense)

User Taste Profile:
- Preferred Genres: ${(params.tasteProfile?.preferredGenres || []).join(', ') || 'Eclectic'}
- Disliked Genres: ${(params.tasteProfile?.dislikedGenres || []).join(', ') || 'None'}
- Favorite Stories: ${(params.tasteProfile?.favoriteStories || []).join(', ') || 'Diverse'}
- Story Elements Enjoyed: ${(params.tasteProfile?.storyElements || []).join(', ') || 'Surprises, depth'}

CRITICAL RULES:
1. ONLY evaluate and rank the candidates provided in the JSON list below. NEVER invent or fabricate any title or author.
2. Provide a 'compatibilityScore' between 60 and 99 reflecting how well it matches their specific mood and taste.
3. Provide a concise, engaging, spoiler-free 'aiExplanation' (1-2 sentences) explaining WHY this matches their current mood and taste.
4. Return up to 6 of the best matching candidates ordered by match score.

Candidates JSON:
${JSON.stringify(candidateSummary, null, 2)}`;

    // Set 6-second timeout race to ensure fast, reliable response
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
    );

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert entertainment curator. Always return strictly valid JSON matching the requested schema. Never invent media titles.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'Candidate ID from the input list' },
              compatibilityScore: { type: Type.INTEGER, description: 'Match score between 60 and 99' },
              aiExplanation: { type: Type.STRING, description: '1-2 sentence personalized explanation' },
            },
            required: ['id', 'compatibilityScore', 'aiExplanation'],
          },
        },
      },
    });

    const response = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '[]') as Array<{
      id: string;
      compatibilityScore: number;
      aiExplanation: string;
    }>;

    // Validate that every returned ID belongs to a real candidate from our verified catalog
    const verifiedResults: RecommendationResult[] = [];
    for (const item of parsed) {
      const match = candidates.find((c) => c.id === item.id);
      if (match) {
        verifiedResults.push({
          id: match.id,
          catalogId: match.catalogId,
          title: match.title,
          mediaType: match.mediaType,
          creator: match.creator,
          releaseYear: match.releaseYear,
          posterUrl: match.posterUrl,
          genres: match.genres,
          runtimeMinutes: match.runtimeMinutes,
          overview: match.overview,
          streamingProviders: match.streamingProviders,
          compatibilityScore: item.compatibilityScore || 85,
          aiExplanation: item.aiExplanation || `Selected based on your mood for ${match.genres.join(', ')}.`,
        });
      }
    }

    if (verifiedResults.length > 0) {
      return verifiedResults;
    }

    return rankCandidatesLocally(candidates, params.moodSettings, params.tasteProfile);
  } catch (error) {
    console.error('Gemini recommendation error or timeout, using local ranking:', error);
    return rankCandidatesLocally(candidates, params.moodSettings, params.tasteProfile);
  }
}

export function rankCandidatesLocally(
  candidates: CatalogMediaItem[],
  mood: MoodSettings,
  taste?: TasteProfile
): RecommendationResult[] {
  const scored = candidates.map((item) => {
    // Calculate distance between user mood and item moodTags
    const darknessDiff = Math.abs(item.moodTags.darkness - mood.darkness);
    const romanceDiff = Math.abs(item.moodTags.romance - mood.romance);
    const suspenseDiff = Math.abs(item.moodTags.suspense - mood.suspense);
    const twistDiff = Math.abs(item.moodTags.plotTwists - mood.plotTwists);
    const emotionDiff = Math.abs(item.moodTags.emotionalIntensity - mood.emotionalIntensity);

    const totalDiff = darknessDiff + romanceDiff + suspenseDiff + twistDiff + emotionDiff;
    const moodScore = Math.max(60, Math.round(99 - totalDiff * 2.5));

    let genreBoost = 0;
    if (taste?.preferredGenres) {
      const matches = item.genres.filter((g) =>
        taste.preferredGenres.some((pg) => pg.toLowerCase() === g.toLowerCase())
      );
      genreBoost = matches.length * 3;
    }

    const finalScore = Math.min(99, moodScore + genreBoost);

    return {
      id: item.id,
      catalogId: item.catalogId,
      title: item.title,
      mediaType: item.mediaType,
      creator: item.creator,
      releaseYear: item.releaseYear,
      posterUrl: item.posterUrl,
      genres: item.genres,
      runtimeMinutes: item.runtimeMinutes,
      overview: item.overview,
      streamingProviders: item.streamingProviders,
      compatibilityScore: finalScore,
      aiExplanation: `Matches your mood for ${item.genres[0] || 'storytelling'} with a plot twist profile tailored for you.`,
    };
  });

  scored.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  return scored.slice(0, 6);
}

export async function scanMediaPosterOrCover(imageBase64: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const prompt = `Analyze this image of a book cover, movie poster, or media title.
Identify the exact title, creator/author/director, media format (book, movie, tv, or podcast), and primary genres.
Also evaluate whether this is a recognizable media title.
Return strictly a JSON object with:
- title: string (the exact recognized title)
- creator: string (author or director)
- mediaType: 'movie' | 'tv' | 'book' | 'podcast'
- genres: string[]
- summary: string (short description)
- confidence: number (0-100)
If the image does not show a recognizable media title, set confidence below 40.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          creator: { type: Type.STRING },
          mediaType: { type: Type.STRING, enum: ['movie', 'tv', 'book', 'podcast'] },
          genres: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
          confidence: { type: Type.INTEGER },
        },
        required: ['title', 'mediaType', 'confidence'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}
