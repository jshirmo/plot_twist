import assert from 'node:assert/strict';
import test from 'node:test';
import { describeScanMatch, rankSwipeDeck } from './apiRouter';
import { VERIFIED_CATALOG } from './mediaCatalog';

test('swipe feedback promotes and demotes similar titles without crossing formats', () => {
  const candidates = VERIFIED_CATALOG.filter((item) => item.mediaType === 'movie');
  const source = candidates.find((item) => item.id === 'movie_knives_out')!;
  const ranked = rankSwipeDeck(candidates, [{
    mediaId: source.id,
    mediaType: 'movie',
    decision: 'interested',
    feedbackStatus: 'active',
    genres: source.genres,
    moodTags: source.moodTags,
  }, {
    mediaId: source.id,
    mediaType: 'movie',
    decision: 'pass',
    feedbackStatus: 'active',
    genres: ['Romance'],
    moodTags: { darkness: 2, romance: 5, suspense: 2, plotTwists: 2, emotionalIntensity: 5 },
  }]);

  const mystery = ranked.find((item) => item.id === 'movie_gone_girl')!;
  const romance = ranked.find((item) => item.id === 'movie_portrait_lady')!;
  assert.ok(mystery.compatibilityScore > romance.compatibilityScore);
  assert.equal(ranked.every((item) => item.mediaType === 'movie'), true);
});

test('a deck seed creates a stable, non-catalog-order tie break', () => {
  const candidates = VERIFIED_CATALOG.filter((item) => item.mediaType === 'movie');
  const first = rankSwipeDeck(candidates, [], undefined, 12345).map((item) => item.id);
  const repeat = rankSwipeDeck(candidates, [], undefined, 12345).map((item) => item.id);
  const catalogOrder = candidates.map((item) => item.id);

  assert.deepEqual(repeat, first);
  assert.notDeepEqual(first, catalogOrder);
});

test('scan explanation is short and ties a recognized title to a preferred genre', () => {
  const why = describeScanMatch({
    title: 'Example',
    mediaType: 'book',
    genres: ['Mystery', 'Drama'],
    confidence: 91,
    summary: 'A tense investigation with a long description that explains the premise without revealing the ending.',
  }, {
    preferredGenres: ['Mystery'],
    preferredFormats: ['book'],
    favoriteStories: [],
    storyElements: [],
    dislikedGenres: [],
    timeAvailability: 'any',
    streamingServices: [],
  });

  assert.match(why, /Mystery/);
  assert.ok(why.length <= 230);
});
