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

test('Gemini can rank real filtered titles but cannot add titles or replace metadata', async (t) => {
  const keys = ['TMDB_API_KEY', 'GEMINI_API_KEY', 'GEMINI_RECOMMENDATION_MODEL'] as const;
  const previous = keys.map((key) => process.env[key]);
  delete process.env.TMDB_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_RECOMMENDATION_MODEL;
  t.after(() => keys.forEach((key, index) => {
    const value = previous[index];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }));
  const [disliked, allowed] = VERIFIED_CATALOG.filter((item) => item.mediaType === 'movie');
  let requestUrl = '';
  let prompt = '';
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    prompt = String(init?.body);
    const output = [
      { id: 'invented', compatibilityScore: 99, aiExplanation: 'Invented' },
      { id: disliked.id, compatibilityScore: 98, aiExplanation: 'Disliked' },
      { id: allowed.id, title: 'Made up title', compatibilityScore: 95, aiExplanation: 'Matches your mood.' },
      { id: allowed.id, compatibilityScore: 94, aiExplanation: 'Duplicate' },
    ];
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] });
  });

  const results = await generateRecommendations({
    moodSettings: mood,
    formats: ['movie'],
    ratingFeedback: { liked: [allowed], disliked: [disliked] },
  });
  assert.match(requestUrl, /gemini-3\.8-flash:generateContent/);
  assert.ok(prompt.includes(allowed.title));
  assert.deepEqual(results.map(({ id, title }) => ({ id, title })), [{ id: allowed.id, title: allowed.title }]);
  assert.equal(results[0].compatibilityScore, 95);
});
