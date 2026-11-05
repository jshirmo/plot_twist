import { GoogleGenAI, Type } from '@google/genai';
import type { MoodSettings, TasteProfile } from '../src/types';
import type { CatalogMediaItem } from './mediaCatalog';

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
  pageCount?: number;
  overview: string;
  streamingProviders?: string[];
  compatibilityScore: number;
  aiExplanation: string;
}

export interface RecommendationResponse {
  results: RecommendationResult[];
  usedFallback: boolean;
}

const MAX_RECOMMENDATIONS = 12;

function resultFromCandidate(candidate: CatalogMediaItem, score: number, explanation: string): RecommendationResult {
  return {
    id: candidate.id,
    catalogId: candidate.catalogId,
    title: candidate.title,
    mediaType: candidate.mediaType,
    creator: candidate.creator,
    releaseYear: candidate.releaseYear,
    posterUrl: candidate.posterUrl,
    genres: candidate.genres,
    runtimeMinutes: candidate.runtimeMinutes,
    pageCount: candidate.pageCount,
    overview: candidate.overview,
    streamingProviders: candidate.streamingProviders,
    compatibilityScore: Math.max(60, Math.min(99, Math.round(score))),
    aiExplanation: explanation.slice(0, 320),
  };
}

export function rankCandidatesLocally(
  candidates: CatalogMediaItem[],
  mood: MoodSettings,
  taste?: TasteProfile
): RecommendationResult[] {
  const scored = candidates.map((item) => {
    const tags = item.moodTags;
    const totalDiff = Math.abs(tags.darkness - mood.darkness) + Math.abs(tags.romance - mood.romance) +
      Math.abs(tags.suspense - mood.suspense) + Math.abs(tags.plotTwists - mood.plotTwists) +
      Math.abs(tags.emotionalIntensity - mood.emotionalIntensity);
    const preferredMatches = item.genres.filter((genre) => taste?.preferredGenres.some((preferred) => preferred.toLowerCase() === genre.toLowerCase())).length;
    const dislikedMatches = item.genres.filter((genre) => taste?.dislikedGenres.some((disliked) => disliked.toLowerCase() === genre.toLowerCase())).length;
    const score = 94 - totalDiff * 3 + preferredMatches * 5 - dislikedMatches * 12;
    const matchingGenre = item.genres.find((genre) => taste?.preferredGenres.some((preferred) => preferred.toLowerCase() === genre.toLowerCase()));
    const reason = matchingGenre
      ? `A verified ${item.mediaType} pick that pairs your current mood with your interest in ${matchingGenre}.`
      : `A verified ${item.mediaType} pick matched to your current mood settings and story preferences.`;
    return resultFromCandidate(item, score, reason);
  });
  return scored
    .sort((left, right) => right.compatibilityScore - left.compatibilityScore)
    .slice(0, MAX_RECOMMENDATIONS);
}

export async function generateRecommendations(params: {
  tasteProfile: TasteProfile;
  moodSettings: MoodSettings;
  candidates: CatalogMediaItem[];
}): Promise<RecommendationResponse> {
  if (params.candidates.length === 0) return { results: [], usedFallback: true };
  if (!process.env.GEMINI_API_KEY) {
    return { results: rankCandidatesLocally(params.candidates, params.moodSettings, params.tasteProfile), usedFallback: true };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const summaries = params.candidates.map((candidate) => ({
    id: candidate.id, mediaType: candidate.mediaType, title: candidate.title, creator: candidate.creator,
    genres: candidate.genres, overview: candidate.overview.slice(0, 500),
  }));
  const prompt = `Rank only the verified catalog candidates below for this Plot Twist user. Do not create, rename, or add a title, creator, provider, or catalog ID. Return at most ${MAX_RECOMMENDATIONS} candidates.

Mood (1-5): darkness ${params.moodSettings.darkness}, romance ${params.moodSettings.romance}, suspense ${params.moodSettings.suspense}, plot twists ${params.moodSettings.plotTwists}, emotional intensity ${params.moodSettings.emotionalIntensity}.
Taste: preferred genres ${params.tasteProfile.preferredGenres.join(', ') || 'not set'}; disliked genres ${params.tasteProfile.dislikedGenres.join(', ') || 'none'}; favorite stories ${params.tasteProfile.favoriteStories.join(', ') || 'not set'}; preferred story elements ${params.tasteProfile.storyElements.join(', ') || 'not set'}.

For each choice, give a short spoiler-free explanation based only on the title's provided metadata and the user’s mood/taste.
Candidates: ${JSON.stringify(summaries)}`;

  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Gemini timed out')), 8000));
    const call = ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.OBJECT, properties: {
            id: { type: Type.STRING }, compatibilityScore: { type: Type.INTEGER }, aiExplanation: { type: Type.STRING },
          }, required: ['id', 'compatibilityScore', 'aiExplanation'] },
        },
      },
    });
    const response = await Promise.race([call, timeout]);
    const ranked = JSON.parse(response.text || '[]') as Array<{ id?: unknown; compatibilityScore?: unknown; aiExplanation?: unknown }>;
    const seen = new Set<string>();
    const verified = ranked.flatMap((rank) => {
      if (typeof rank.id !== 'string' || seen.has(rank.id)) return [];
      const candidate = params.candidates.find((item) => item.id === rank.id);
      if (!candidate) return [];
      seen.add(rank.id);
      return [resultFromCandidate(candidate, typeof rank.compatibilityScore === 'number' ? rank.compatibilityScore : 80,
        typeof rank.aiExplanation === 'string' ? rank.aiExplanation : 'A verified match for your current mood and saved taste profile.')];
    });
    if (verified.length > 0) return { results: verified.slice(0, MAX_RECOMMENDATIONS), usedFallback: false };
  } catch (error) {
    console.error('Gemini ranking failed; returning verified local ranking.', error);
  }
  return { results: rankCandidatesLocally(params.candidates, params.moodSettings, params.tasteProfile), usedFallback: true };
}

export async function scanMediaPosterOrCover(imageBase64: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured on the server');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: { parts: [{ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }, { text: 'Identify the visible media title only if you can read it. Return JSON with title, creator, mediaType, genres, summary, confidence. Do not guess.' }] },
    config: { responseMimeType: 'application/json' },
  });
  return JSON.parse(response.text || '{}');
}
