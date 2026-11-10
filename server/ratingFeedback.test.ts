import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRecommendations, rankCandidatesLocally } from './geminiService';
import { VERIFIED_CATALOG } from './mediaCatalog';
import { parseRatingFeedback } from './ratingFeedback';

const mood = { darkness: 2, romance: 2, suspense: 2, plotTwists: 2, emotionalIntensity: 2 };

test('ratings change fallback ranking and exclude a disliked title in its own format', () => {
  const base = VERIFIED_CATALOG[0];
  const title = 'Shared Title';
  const candidates = [
    { ...base, id: 'movie', title, mediaType: 'movie' as const, genres: ['Horror'] },
    { ...base, id: 'book', title, mediaType: 'book' as const, genres: ['Horror'] },
    { ...base, id: 'mystery', genres: ['Mystery'] },
  ];
  const feedback = parseRatingFeedback({
    liked: [{ title: 'Example mystery', mediaType: 'book', genres: ['mystery'] }],
    disliked: [null, { title: ' shared   TITLE ', mediaType: 'movie', genres: ['Horror', 42] }],
  });

  const results = rankCandidatesLocally(candidates, mood, undefined, feedback);
  assert.deepEqual(results.map(({ id }) => id), ['mystery', 'book']);
  assert.ok(results[0].compatibilityScore > results[1].compatibilityScore);
});

test('excluding the entire filtered format returns no matches without widening the search', async () => {
  const books = VERIFIED_CATALOG.filter((item) => item.mediaType === 'book');
  assert.ok(books.length > 0);
  const results = await generateRecommendations({
    moodSettings: mood,
    formats: ['book'],
    ratingFeedback: { liked: [], disliked: books },
  });
  assert.deepEqual(results, []);
});
