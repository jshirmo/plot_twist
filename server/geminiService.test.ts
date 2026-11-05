import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations, rankCandidatesLocally } from './geminiService';
import type { CatalogMediaItem } from './mediaCatalog';
import type { MoodSettings, TasteProfile } from '../src/types';

const mood: MoodSettings = { darkness: 4, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 4 };
const candidates: CatalogMediaItem[] = [
  {
    id: 'tmdb:movie:mystery', catalogId: '101', source: 'tmdb', mediaType: 'movie', title: 'Verified Mystery', creator: 'Director', releaseYear: '2025', posterUrl: '', genres: ['Mystery', 'Thriller'], overview: 'A mystery.',
    moodTags: { darkness: 4, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 4 },
  },
  {
    id: 'google-books:romance', catalogId: 'book-1', source: 'google_books', mediaType: 'book', title: 'Verified Romance', creator: 'Author', releaseYear: '2025', posterUrl: '', genres: ['Romance', 'Drama'], overview: 'A romance.',
    moodTags: { darkness: 1, romance: 5, suspense: 1, plotTwists: 1, emotionalIntensity: 4 },
  },
];

function profile(overrides: Partial<TasteProfile>): TasteProfile {
  return {
    preferredGenres: [], preferredFormats: ['movie', 'book'], favoriteStories: [], storyElements: [], dislikedGenres: [], timeAvailability: '', streamingServices: [], ...overrides,
  };
}

test('dark, twist-heavy mystery profile ranks the verified mystery first', () => {
  const results = rankCandidatesLocally(candidates, mood, profile({ preferredGenres: ['Mystery'] }));
  assert.equal(results[0].id, 'tmdb:movie:mystery');
  assert.match(results[0].aiExplanation, /verified/i);
});

test('romance-focused mood and profile change the highest-ranked verified candidate', () => {
  const romanceMood: MoodSettings = { darkness: 1, romance: 5, suspense: 1, plotTwists: 1, emotionalIntensity: 4 };
  const results = rankCandidatesLocally(candidates, romanceMood, profile({ preferredGenres: ['Romance'] }));
  assert.equal(results[0].id, 'google-books:romance');
});

test('a disliked genre lowers a candidate score without inventing a replacement title', () => {
  const results = rankCandidatesLocally(candidates, mood, profile({ preferredGenres: ['Mystery'], dislikedGenres: ['Mystery'] }));
  assert.equal(results.every((result) => candidates.some((candidate) => candidate.id === result.id)), true);
  assert.ok(results.find((result) => result.id === 'tmdb:movie:mystery')!.compatibilityScore < 99);
});

test('the recommendation engine can return twelve verified titles', () => {
  const expandedCandidates = Array.from({ length: 13 }, (_, index) => ({
    ...candidates[index % candidates.length],
    id: `verified-${index}`,
    catalogId: `catalog-${index}`,
    title: `Verified title ${index}`,
  }));

  const results = rankCandidatesLocally(expandedCandidates, mood, profile({ preferredGenres: ['Mystery'] }));
  assert.equal(results.length, 12);
  assert.equal(results.every((result) => expandedCandidates.some((candidate) => candidate.id === result.id)), true);
});

test('Gemini failure configuration falls back to verified local ranking', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await generateRecommendations({ candidates, moodSettings: mood, tasteProfile: profile({ preferredGenres: ['Mystery'] }) });
    assert.equal(response.usedFallback, true);
    assert.equal(response.results[0].id, 'tmdb:movie:mystery');
    assert.equal(response.results.every((result) => candidates.some((candidate) => candidate.id === result.id)), true);
  } finally {
    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  }
});
