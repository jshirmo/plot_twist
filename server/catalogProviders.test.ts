import assert from 'node:assert/strict';
import test from 'node:test';
import { cachedCatalogRequest, mapGoogleVolume, mapTmdbTitle } from './catalogProviders';
import { loadCatalog } from './mediaCatalog';

test('maps real provider metadata and uses U.S. streaming availability only', () => {
  const item = mapTmdbTitle('tv', {
    id: 7, name: 'Example', created_by: [{ name: 'Creator' }],
    episode_run_time: [42], genres: [{ name: 'Mystery' }],
  }, {
    results: {
      US: { flatrate: [{ provider_id: 1, provider_name: 'HBO Max' }] },
      GB: { flatrate: [{ provider_id: 2, provider_name: 'Netflix' }] },
    },
  });
  assert.equal(item?.creator, 'Creator');
  assert.equal(item?.runtimeMinutes, 42);
  assert.deepEqual(item?.streamingProviders, ['HBO Max']);

  const book = mapGoogleVolume({
    id: 'example', volumeInfo: { title: 'Example', pageCount: 120, categories: ['Fiction / Mystery'],
      imageLinks: { thumbnail: 'http://books.google.com/image' } },
  });
  assert.equal(book?.pageCount, 120);
  assert.equal(book?.posterUrl, 'https://books.google.com/image');
  assert.deepEqual(book?.genres, ['Fiction', 'Mystery']);
});

test('coalesces concurrent requests and caches failures briefly', async () => {
  let calls = 0;
  const load = async () => { calls++; throw new Error('429'); };
  const requests = [cachedCatalogRequest('test:429', 1000, load), cachedCatalogRequest('test:429', 1000, load)];
  await Promise.all(requests.map((request) => assert.rejects(request, /429/)));
  await assert.rejects(cachedCatalogRequest('test:429', 1000, load), /429/);
  assert.equal(calls, 1);
});

test('searches TMDB, checks watch providers, and falls back independently when Books fails', async (t) => {
  const previousTmdb = process.env.TMDB_API_KEY;
  const previousBooks = process.env.GOOGLE_BOOKS_API_KEY;
  process.env.TMDB_API_KEY = 'test-key';
  process.env.GOOGLE_BOOKS_API_KEY = 'test-key';
  t.after(() => {
    if (previousTmdb === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = previousTmdb;
    if (previousBooks === undefined) delete process.env.GOOGLE_BOOKS_API_KEY;
    else process.env.GOOGLE_BOOKS_API_KEY = previousBooks;
  });
  const paths: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    paths.push(url.pathname);
    if (url.hostname === 'www.googleapis.com') return new Response(null, { status: 429 });
    if (url.pathname === '/3/search/movie') {
      assert.equal(url.searchParams.get('query'), 'The Silent Patient');
      return Response.json({ results: [{ id: 99999, title: 'The Silent Patient' }] });
    }
    if (url.pathname.endsWith('/watch/providers')) {
      return Response.json({ results: { US: { flatrate: [{ provider_id: 1, provider_name: 'HBO Max' }] } } });
    }
    return Response.json({ id: 99999, title: 'The Silent Patient', runtime: 155 });
  });
  const options = { search: 'The Silent Patient', formats: ['movie', 'book'], streamingServices: ['Max'], maxDurationMinutes: 180 };
  const result = await loadCatalog(options);
  assert.deepEqual(result.map(({ mediaType, catalogOrigin }) => [mediaType, catalogOrigin]), [
    ['movie', 'live'], ['book', 'fallback'],
  ]);
  await loadCatalog(options);
  assert.equal(paths.length, 4);
});
