// "Near You" data: live story events (Ticketmaster Discovery API) and nearby
// bookstores (Google Places API, New). Owner: Chloe.
// What counts as a story event, and how it's matched and explained, lives in liveStories.ts.
//
// Needs TICKETMASTER_API_KEY and GOOGLE_PLACES_API_KEY in .env.
// Privacy: a user's location is only used for the outgoing request. It's rounded to about
// 100 m, never logged, and never saved to Firestore.

import {
  classifyEvent,
  emptyStoryContext,
  showKey,
  type EventBadge,
  type EventSignals,
  type LiveKind,
  type MatchTier,
  type StoryContext,
} from './liveStories';

export type { EventBadge, LiveKind, MatchTier, StoryContext } from './liveStories';

const TICKETMASTER_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json';
const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REQUEST_TIMEOUT_MS = 8000;

export interface LocationQuery {
  lat?: number;
  lng?: number;
  city?: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  url: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM:SS, local to the venue
  imageUrl?: string;
  venueName?: string;
  venueCity?: string;
  venueState?: string;
  distanceMiles?: number;
  category?: string;
  priceRange?: string;
  matchedPodcast?: string; // set when the event matches a podcast in the user's library
  matchedTitle?: string; // the saved podcast, book, author, movie or show it matched
  kind: LiveKind;
  badges?: EventBadge[];
  tier?: MatchTier;
  reason?: string; // plain-language "why this event"
  moreDates?: number; // other nights of the same show that were collapsed into this card
}

export interface LiveEventsResult {
  events: LocalEvent[];
  // true when nothing matched a saved title or a clearly labeled adaptation
  fallback: boolean;
  // true when comedy shows were added because few story events were found
  comedyIncluded?: boolean;
}

export interface Bookstore {
  id: string;
  name: string;
  address: string;
  distanceMiles?: number;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  mapsUrl?: string;
  websiteUrl?: string;
}

export function localServiceStatus() {
  return {
    events: Boolean(process.env.TICKETMASTER_API_KEY),
    bookstores: Boolean(process.env.GOOGLE_PLACES_API_KEY),
  };
}

// ---------- Helpers ----------

const cache = new Map<string, { expires: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return value;
}

const round = (n: number) => Math.round(n * 1000) / 1000; // ~100 m

export function hasCoords(loc: LocationQuery): loc is { lat: number; lng: number; city?: string } {
  return (
    typeof loc.lat === 'number' &&
    typeof loc.lng === 'number' &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng) &&
    Math.abs(loc.lat) <= 90 &&
    Math.abs(loc.lng) <= 180
  );
}

export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ticketmaster lists each night of a run as its own event. Keep the first card per show
// (input should already be in the order to keep) and count the other nights in moreDates.
export function collapseRuns<T extends LocalEvent>(events: T[]): Array<T & Pick<LocalEvent, 'moreDates'>> {
  const byName = new Map<string, T & Pick<LocalEvent, 'moreDates'>>();
  for (const ev of events) {
    const key = showKey(ev.name) || ev.id;
    const first = byName.get(key);
    if (first) first.moreDates = (first.moreDates || 0) + 1;
    else byName.set(key, { ...ev });
  }
  return [...byName.values()];
}

// Ticketmaster deprecated "latlong" in favor of "geoPoint", which takes a geohash.
const GEOHASH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = '', bit = 0, ch = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch = ch << 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch = ch << 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { hash += GEOHASH_CHARS[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

// ---------- Ticketmaster: live podcast shows & events ----------

interface RawTmEvent {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  images?: Array<{ url: string; width?: number; ratio?: string }>;
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  info?: string;
  pleaseNote?: string;
  description?: string;
  classifications?: Array<{
    primary?: boolean;
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  distance?: number;
  _embedded?: {
    venues?: Array<{
      name?: string;
      city?: { name?: string };
      state?: { stateCode?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
}

function pickImage(images: RawTmEvent['images'] = []): string | undefined {
  const wide = images.filter((i) => i.ratio === '16_9').sort((a, b) => (a.width || 0) - (b.width || 0));
  return (wide.find((i) => (i.width || 0) >= 600) || wide[0] || images[0])?.url;
}

export function mapTicketmasterEvent(ev: RawTmEvent, from?: { lat: number; lng: number }): LocalEvent {
  const venue = ev._embedded?.venues?.[0];
  const price = ev.priceRanges?.[0];
  const cls = ev.classifications?.[0];
  let distance: number | undefined;
  const vLat = Number(venue?.location?.latitude);
  const vLng = Number(venue?.location?.longitude);
  if (from && Number.isFinite(vLat) && Number.isFinite(vLng) && venue?.location?.latitude) {
    distance = distanceMiles(from.lat, from.lng, vLat, vLng);
  }
  const genre = cls?.genre?.name && cls.genre.name !== 'Undefined' ? cls.genre.name : undefined;
  return {
    id: ev.id,
    kind: /podcast/i.test(ev.name) ? 'podcast' : 'other',
    name: ev.name,
    url: ev.url,
    date: ev.dates?.start?.localDate || '',
    time: ev.dates?.start?.localTime,
    imageUrl: pickImage(ev.images),
    venueName: venue?.name,
    venueCity: venue?.city?.name,
    venueState: venue?.state?.stateCode,
    distanceMiles: distance,
    category: genre || cls?.segment?.name,
    priceRange:
      price?.min !== undefined
        ? `$${Math.round(price.min)}${price.max && price.max !== price.min ? `–$${Math.round(price.max)}` : ''}`
        : undefined,
  };
}

const named = (value?: string) => (value && value !== 'Undefined' ? value : undefined);

/** The listing details liveStories.ts looks at. */
export function eventSignals(ev: RawTmEvent, today = new Date()): EventSignals {
  const cls = ev.classifications?.find((c) => c.primary) || ev.classifications?.[0];
  const date = ev.dates?.start?.localDate;
  const daysAway = date ? Math.round((Date.parse(`${date}T12:00:00`) - today.getTime()) / 86_400_000) : undefined;
  return {
    name: ev.name,
    details: [ev.info, ev.pleaseNote, ev.description].filter(Boolean).join(' ').slice(0, 1500),
    segment: named(cls?.segment?.name),
    genre: named(cls?.genre?.name),
    subGenre: named(cls?.subGenre?.name),
    daysAway: Number.isFinite(daysAway) ? daysAway : undefined,
  };
}

async function ticketmasterSearch(
  keyword: string,
  loc: LocationQuery,
  size: number,
  classificationName?: string
): Promise<RawTmEvent[]> {
  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY as string,
    size: String(size),
    sort: 'date,asc',
  });
  if (keyword) params.set('keyword', keyword);
  if (classificationName) params.set('classificationName', classificationName);
  if (hasCoords(loc)) {
    params.set('geoPoint', encodeGeohash(loc.lat, loc.lng, 7));
    params.set('radius', '75');
    params.set('unit', 'miles');
  } else if (loc.city) {
    params.set('city', loc.city);
  }

  const key = `tm:${keyword}:${classificationName || ''}:${params.get('geoPoint') || params.get('city')}:${size}`;
  return cached(key, async () => {
    const res = await fetch(`${TICKETMASTER_BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 429) throw new Error('Ticketmaster rate limit reached');
    if (!res.ok) throw new Error(`Ticketmaster failed with status ${res.status}`);
    const data = (await res.json()) as { _embedded?: { events?: RawTmEvent[] } };
    return data._embedded?.events || [];
  });
}

interface SearchPlan {
  keyword?: string;
  classificationName?: string;
  size: number;
  podcastSearch?: boolean;
}

const MAX_EVENTS = 40;
const MIN_STORY_EVENTS = 6; // fewer than this and comedy is added as a last resort
const MAX_SAVED_SEARCHES = 6;

/** Saved titles worth their own keyword search, best signals first. */
function savedSearches(ctx: StoryContext): SearchPlan[] {
  const picks: string[] = [];
  const take = (list: string[], n: number) => list.map((t) => t.trim()).filter((t) => t.length > 3).slice(0, n).forEach((t) => picks.push(t));
  take(ctx.podcasts, 2);
  take(ctx.books.map((b) => b.title), 2);
  take(ctx.books.map((b) => b.author || '').filter((a) => a.split(' ').length >= 2), 1);
  take([...ctx.movies.slice(0, 1), ...ctx.shows.slice(0, 1)], 2);
  return [...new Set(picks)].slice(0, MAX_SAVED_SEARCHES).map((keyword) => ({ keyword: keyword.split(':')[0], size: 10 }));
}

/** The story searches every request runs (results are cached for 10 minutes per place). */
const STORY_SEARCHES: SearchPlan[] = [
  { keyword: 'podcast', size: 30, podcastSearch: true },
  { classificationName: 'Theatre', size: 40 },
  { classificationName: 'Film', size: 30 },
  { keyword: 'screening', size: 15 },
  { keyword: 'in concert', classificationName: 'Classical', size: 15 }, // movies with a live orchestra
  { keyword: 'immersive', size: 20 },
  { keyword: 'murder mystery', size: 15 },
  { keyword: 'author', size: 15 },
];

export interface LiveEventsDeps {
  /** Pause between batches; Ticketmaster allows about 5 requests per second. */
  pauseMs?: number;
  today?: Date;
}

/**
 * Live events that bring stories to life near a location: podcast tapings, theatre and
 * musicals, screenings, author events, readings, and immersive or mystery experiences.
 * Events matching the user's saved podcasts, books, authors, movies and shows rank first,
 * then clearly labeled adaptations, then story events, then taste matches. Comedy is only
 * added when fewer than six story events turn up.
 */
export async function getLiveEvents(
  loc: LocationQuery,
  context: Partial<StoryContext> | string[] = {},
  deps: LiveEventsDeps = {},
): Promise<LiveEventsResult> {
  if (!process.env.TICKETMASTER_API_KEY) throw new Error('not_configured');
  if (!hasCoords(loc) && !loc.city) throw new Error('location_required');

  const ctx: StoryContext = Array.isArray(context)
    ? { ...emptyStoryContext(), podcasts: context }
    : { ...emptyStoryContext(), ...context };
  const from = hasCoords(loc) ? { lat: loc.lat, lng: loc.lng } : undefined;
  const pauseMs = deps.pauseMs ?? 1100;
  const today = deps.today ?? new Date();

  // Raw listings by id, remembering whether the "podcast" search found them.
  const raw = new Map<string, { ev: RawTmEvent; podcastSearch: boolean }>();
  let failures = 0;
  const run = async (plans: SearchPlan[]) => {
    for (let i = 0; i < plans.length; i += 4) {
      if (i > 0 && pauseMs) await sleep(pauseMs);
      await Promise.all(plans.slice(i, i + 4).map(async (plan) => {
        try {
          const events = await ticketmasterSearch(plan.keyword || '', loc, plan.size, plan.classificationName);
          for (const ev of events) {
            const seen = raw.get(ev.id);
            raw.set(ev.id, { ev, podcastSearch: Boolean(seen?.podcastSearch || plan.podcastSearch) });
          }
        } catch (err) {
          failures += 1;
          console.error('Ticketmaster search failed:', (err as Error).message);
        }
      }));
    }
  };

  const plans = [...savedSearches(ctx), ...STORY_SEARCHES];
  await run(plans);
  if (failures === plans.length) throw new Error('Ticketmaster is unavailable right now');

  const classify = (allowComedy: boolean) => {
    const out: Array<LocalEvent & { score: number }> = [];
    for (const { ev, podcastSearch } of raw.values()) {
      const match = classifyEvent({ ...eventSignals(ev, today), fromPodcastSearch: podcastSearch }, ctx, { allowComedy });
      if (!match) continue;
      out.push({
        ...mapTicketmasterEvent(ev, from),
        kind: match.kind,
        badges: match.badges,
        tier: match.tier,
        reason: match.reason,
        matchedTitle: match.matchedTitle,
        matchedPodcast: match.matchedPodcast,
        score: match.score,
      });
    }
    return out;
  };

  let scored = classify(false);
  let comedyIncluded = false;
  if (collapseRuns(scored).length < MIN_STORY_EVENTS) {
    // Last resort only: comedy isn't a story event, so it always ranks below them.
    await run([{ classificationName: 'Comedy', size: 20 }]);
    scored = classify(true);
    comedyIncluded = scored.some((e) => e.tier === 'comedy');
  }

  const ranked = scored.sort((a, b) => b.score - a.score || (a.date || '9999').localeCompare(b.date || '9999'));
  const events = collapseRuns(ranked).slice(0, MAX_EVENTS).map(({ score: _score, ...ev }) => ev as LocalEvent);
  const fallback = !events.some((e) => e.tier === 'saved' || e.tier === 'adaptation');
  return { events, fallback, comedyIncluded };
}

// ---------- Google Places: bookstores ----------

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  currentOpeningHours?: { openNow?: boolean };
}

const PLACES_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.currentOpeningHours.openNow',
].join(',');

export function mapPlace(p: RawPlace, from?: { lat: number; lng: number }): Bookstore {
  const lat = p.location?.latitude;
  const lng = p.location?.longitude;
  return {
    id: p.id,
    name: p.displayName?.text || 'Bookstore',
    address: p.formattedAddress || '',
    distanceMiles: from && typeof lat === 'number' && typeof lng === 'number' ? distanceMiles(from.lat, from.lng, lat, lng) : undefined,
    rating: p.rating,
    ratingCount: p.userRatingCount,
    openNow: p.currentOpeningHours?.openNow,
    mapsUrl: p.googleMapsUri,
    websiteUrl: p.websiteUri,
  };
}

async function placesPost(url: string, body: unknown): Promise<RawPlace[]> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY as string,
      'X-Goog-FieldMask': PLACES_FIELDS,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google Places failed with status ${res.status}`);
  const data = (await res.json()) as { places?: RawPlace[] };
  return data.places || [];
}

/** Bookstores near coordinates (sorted by distance), or in a city if no coordinates. */
export async function getNearbyBookstores(loc: LocationQuery): Promise<Bookstore[]> {
  if (!process.env.GOOGLE_PLACES_API_KEY) throw new Error('not_configured');

  if (hasCoords(loc)) {
    const from = { lat: round(loc.lat), lng: round(loc.lng) };
    return cached(`places:${from.lat},${from.lng}`, async () => {
      const places = await placesPost(PLACES_NEARBY_URL, {
        includedTypes: ['book_store'],
        maxResultCount: 15,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: { center: { latitude: from.lat, longitude: from.lng }, radius: 16000 }, // ~10 miles
        },
      });
      return places.map((p) => mapPlace(p, from));
    });
  }

  if (loc.city) {
    const city = loc.city;
    return cached(`places:city:${city.toLowerCase()}`, async () => {
      const places = await placesPost(PLACES_TEXT_URL, {
        textQuery: `bookstores in ${city}`,
        includedType: 'book_store',
        pageSize: 15,
      });
      return places.map((p) => mapPlace(p));
    });
  }

  throw new Error('location_required');
}
