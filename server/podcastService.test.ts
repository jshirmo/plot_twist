import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapFeedToCatalogItem,
  estimateMoodTags,
  stripHtml,
  fallbackPodcasts,
  searchPodcasts,
} from './podcastService';
import { mapApplePodcast, mapTopPodcast, mapAppleEpisode, biggerArtwork } from './applePodcasts';
import { distanceMiles, mapTicketmasterEvent, mapPlace, hasCoords, encodeGeohash, collapseRuns } from './localService';

test('maps a Podcast Index feed into the catalog shape', () => {
  const item = mapFeedToCatalogItem({
    id: 920666,
    title: 'Example Crime Show',
    author: 'Jane Host',
    description: '<p>A weekly <b>true crime</b> show &amp; more.</p>',
    artwork: 'https://example.com/art.jpg',
    url: 'https://example.com/feed.xml',
    itunesId: 12345,
    episodeCount: 210,
    newestItemPublishTime: Math.floor(Date.now() / 1000),
    categories: { '1': 'True Crime', '2': 'Society' },
  });
  assert.equal(item.id, 'pod_pi_920666');
  assert.equal(item.mediaType, 'podcast');
  assert.equal(item.source, 'podcast');
  assert.equal(item.overview, 'A weekly true crime show & more.');
  assert.deepEqual(item.genres, ['True Crime', 'Society']);
  assert.ok(item.streamingProviders?.includes('Apple Podcasts'));
  assert.equal(item.appleUrl, 'https://podcasts.apple.com/podcast/id12345');
  assert.ok(item.moodTags.darkness >= 4);
});

test('mood estimates stay on the 1-5 scale', () => {
  const tags = estimateMoodTags(['Comedy', 'Horror', 'Romance']);
  for (const v of Object.values(tags)) assert.ok(v >= 1 && v <= 5);
});

test('stripHtml removes tags and decodes entities', () => {
  assert.equal(stripHtml('<a href="x">Hi</a> &quot;there&quot;'), 'Hi "there"');
});

test('without any keys, search still returns podcasts (Apple, or the fixed list if offline)', async () => {
  delete process.env.PODCAST_INDEX_KEY;
  delete process.env.PODCAST_INDEX_SECRET;
  const results = await searchPodcasts('crime');
  assert.ok(results.length > 0);
  assert.ok(results.every((r) => r.mediaType === 'podcast'));
  assert.ok(fallbackPodcasts().length >= 4);
});

test('distance between New Orleans and Baton Rouge is about 70 miles', () => {
  const d = distanceMiles(29.951, -90.071, 30.451, -91.187);
  assert.ok(d > 65 && d < 80);
});

test('maps a Ticketmaster event and a Google place', () => {
  const ev = mapTicketmasterEvent(
    {
      id: 'e1',
      name: 'Podcast Live',
      url: 'https://ticketmaster.com/e1',
      dates: { start: { localDate: '2026-12-01', localTime: '19:30:00' } },
      priceRanges: [{ min: 35, max: 75 }],
      _embedded: { venues: [{ name: 'Saenger Theatre', city: { name: 'New Orleans' }, state: { stateCode: 'LA' } }] },
    },
    { lat: 29.95, lng: -90.07 }
  );
  assert.equal(ev.priceRange, '$35–$75');
  assert.equal(ev.kind, 'podcast');
  assert.equal(ev.venueCity, 'New Orleans');
  assert.equal(ev.distanceMiles, undefined);

  const place = mapPlace(
    { id: 'p1', displayName: { text: 'Octavia Books' }, location: { latitude: 29.93, longitude: -90.11 } },
    { lat: 29.95, lng: -90.07 }
  );
  assert.equal(place.name, 'Octavia Books');
  assert.ok((place.distanceMiles ?? 0) > 0);
});

test('rejects invalid coordinates', () => {
  assert.equal(hasCoords({ lat: 200, lng: 0 }), false);
  assert.equal(hasCoords({ lat: NaN, lng: 0 }), false);
  assert.equal(hasCoords({ lat: 29.9, lng: -90.1 }), true);
});

test('encodes a geohash for Ticketmaster geoPoint', () => {
  // Known value: 57.64911, 10.40744 -> u4pruyd
  assert.equal(encodeGeohash(57.64911, 10.40744, 7), 'u4pruyd');
  assert.equal(encodeGeohash(29.951, -90.071, 5), '9vrfq');
});

test('maps Apple Podcasts search results, chart entries and episodes', () => {
  const pod = mapApplePodcast({
    collectionId: 1200361736,
    collectionName: 'The Daily',
    artistName: 'The New York Times',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/a/b/100x100bb.jpg',
    genres: ['Daily News', 'Podcasts', 'News'],
    collectionViewUrl: 'https://podcasts.apple.com/us/podcast/the-daily/id1200361736',
    releaseDate: '2026-11-04T10:00:00Z',
    trackCount: 300,
  });
  assert.ok(pod);
  assert.equal(pod!.id, 'pod_ap_1200361736');
  assert.equal(pod!.posterUrl, 'https://is1-ssl.mzstatic.com/image/thumb/a/b/600x600bb.jpg');
  assert.deepEqual(pod!.genres, ['Daily News', 'News']);
  assert.equal(pod!.releaseYear, '2026');

  const top = mapTopPodcast({ id: '123', name: 'Top Show', artistName: 'Host', genres: [{ name: 'True Crime' }] });
  assert.equal(top!.moodTags.darkness, 4);

  const ep = mapAppleEpisode({ trackId: 9, trackName: 'Ep 1', trackTimeMillis: 1_800_000, description: '<p>Hi</p>' });
  assert.equal(ep!.durationMinutes, 30);
  assert.equal(ep!.description, 'Hi');

  assert.equal(mapApplePodcast({ artistName: 'No id' }), null);
  assert.equal(biggerArtwork('https://x/y/60x60bb.png'), 'https://x/y/600x600bb.png');
});

test('live events: podcast shows first, comedy only as a fallback', async () => {
  process.env.TICKETMASTER_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const tmEvent = (id: string, name: string) => ({
    id, name, url: 'https://ticketmaster.com/' + id,
    dates: { start: { localDate: '2026-12-01' } },
  });
  try {
    // Case 1: no podcast shows -> comedy fallback, duplicates by name removed
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      const comedy = String(url).includes('classificationName=Comedy');
      const events = comedy ? [tmEvent('c1', 'Stand-up Night'), tmEvent('c2', 'Stand-up Night'), tmEvent('c3', 'Improv Jam')] : [];
      return new Response(JSON.stringify(events.length ? { _embedded: { events } } : {}), { status: 200 });
    }) as typeof fetch;
    const { getLiveEvents } = await import('./localService');
    const a = await getLiveEvents({ city: 'Smallville' });
    assert.equal(a.fallback, true);
    assert.deepEqual(a.events.map((e) => e.name), ['Stand-up Night', 'Improv Jam']);
    assert.equal(a.events[0].moreDates, 1);
    assert.ok(a.events.every((e) => e.kind === 'comedy'));

    // Case 2: podcast shows exist -> no fallback, comedy never searched
    calls.length = 0;
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      const events = String(url).includes('keyword=podcast') ? [tmEvent('p1', 'Big Podcast Live')] : [];
      return new Response(JSON.stringify(events.length ? { _embedded: { events } } : {}), { status: 200 });
    }) as typeof fetch;
    const b = await getLiveEvents({ city: 'Bigtown' });
    assert.equal(b.fallback, false);
    assert.equal(b.events[0].kind, 'podcast');
    assert.ok(!calls.some((c) => c.includes('classificationName')));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TICKETMASTER_API_KEY;
  }
});

test('collapses multi-night runs of the same show into one card', () => {
  const ev = (id: string, name: string, date: string) => ({ id, name, url: 'u', date, kind: 'podcast' as const });
  const out = collapseRuns([
    ev('1', 'Giggly Squad: The Gehls Gehl Tour', '2027-02-18'),
    ev('2', 'Giggly Squad:  The Gehls Gehl Tour', '2027-02-19'),
    ev('3', 'Other Show', '2027-02-19'),
    ev('4', 'giggly squad: the gehls gehl tour', '2027-02-20'),
  ]);
  assert.deepEqual(out.map((e) => [e.id, e.moreDates ?? 0]), [['1', 2], ['3', 0]]);
});
