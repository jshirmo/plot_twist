import test from 'node:test';
import assert from 'node:assert/strict';
import { getFilteredCatalogCandidates, VERIFIED_CATALOG } from './mediaCatalog';

test('catalog contains verified items across all 4 media formats', () => {
  const formats = new Set(VERIFIED_CATALOG.map((i) => i.mediaType));
  assert.equal(formats.has('movie'), true);
  assert.equal(formats.has('tv'), true);
  assert.equal(formats.has('book'), true);
  assert.equal(formats.has('podcast'), true);
  assert.ok(VERIFIED_CATALOG.length >= 12);
});

test('filtering by format returns only requested formats', () => {
  const movies = getFilteredCatalogCandidates({ formats: ['movie'] });
  assert.ok(movies.length > 0);
  for (const m of movies) {
    assert.equal(m.mediaType, 'movie');
  }

  const booksAndPodcasts = getFilteredCatalogCandidates({ formats: ['book', 'podcast'] });
  for (const item of booksAndPodcasts) {
    assert.ok(item.mediaType === 'book' || item.mediaType === 'podcast');
  }
});

test('filtering by max duration restricts runtime correctly', () => {
  const shortItems = getFilteredCatalogCandidates({ maxDurationMinutes: 60 });
  for (const item of shortItems) {
    if (item.runtimeMinutes) {
      assert.ok(item.runtimeMinutes <= 60);
    }
  }
});

test('filtering by streaming service matches available providers', () => {
  const netflixItems = getFilteredCatalogCandidates({ streamingServices: ['Netflix'] });
  assert.ok(netflixItems.length > 0);
  for (const item of netflixItems) {
    if (item.mediaType === 'movie' || item.mediaType === 'tv') {
      assert.ok(item.streamingProviders?.some((p) => p.toLowerCase() === 'netflix'));
    }
  }
});
