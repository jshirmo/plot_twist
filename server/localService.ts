// "Near You" data: live podcast shows/events (Ticketmaster Discovery API) and nearby
// bookstores (Google Places API, New). Owner: Chloe.
//
// Needs TICKETMASTER_API_KEY and GOOGLE_PLACES_API_KEY in .env.
// Privacy: a user's location is only used for the outgoing request. It's rounded to about
// 100 m, never logged, and never saved to Firestore.

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

// ---------- Ticketmaster: live podcast shows & events ----------

interface RawTmEvent {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  images?: Array<{ url: string; width?: number; ratio?: string }>;
  priceRanges?: Array<{ min?: number; max?: number; currency?: string }>;
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
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

async function ticketmasterSearch(keyword: string, loc: LocationQuery, size: number): Promise<RawTmEvent[]> {
  const params = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY as string,
    keyword,
    size: String(size),
    sort: 'date,asc',
  });
  if (hasCoords(loc)) {
    params.set('latlong', `${round(loc.lat)},${round(loc.lng)}`);
    params.set('radius', '75');
    params.set('unit', 'miles');
  } else if (loc.city) {
    params.set('city', loc.city);
  }

  const key = `tm:${keyword}:${params.get('latlong') || params.get('city')}:${size}`;
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

/**
 * Live podcast shows near a location. Searches "podcast" plus up to 5 podcast titles
 * from the user's library, so a live taping of a show they listen to rises to the top.
 */
export async function getLiveEvents(loc: LocationQuery, libraryPodcasts: string[] = []): Promise<LocalEvent[]> {
  if (!process.env.TICKETMASTER_API_KEY) throw new Error('not_configured');
  if (!hasCoords(loc) && !loc.city) throw new Error('location_required');

  const from = hasCoords(loc) ? { lat: loc.lat, lng: loc.lng } : undefined;
  const titles = libraryPodcasts.map((t) => t.trim()).filter((t) => t.length > 1).slice(0, 5);

  const results = new Map<string, LocalEvent>();

  // Shows from the user's own podcasts first. Ticketmaster allows ~5 requests/second,
  // so these run one after another with a short pause.
  for (const title of titles) {
    try {
      const events = await ticketmasterSearch(title, loc, 5);
      for (const ev of events) {
        if (!ev.name.toLowerCase().includes(title.toLowerCase().split(':')[0])) continue;
        if (!results.has(ev.id)) results.set(ev.id, { ...mapTicketmasterEvent(ev, from), matchedPodcast: title });
      }
    } catch (err) {
      console.error('Ticketmaster title search failed:', (err as Error).message);
    }
    await sleep(250);
  }

  // Then general live podcast shows.
  const general = await ticketmasterSearch('podcast', loc, 30);
  for (const ev of general) {
    if (!results.has(ev.id)) results.set(ev.id, mapTicketmasterEvent(ev, from));
  }

  return [...results.values()].sort((a, b) => {
    if (Boolean(a.matchedPodcast) !== Boolean(b.matchedPodcast)) return a.matchedPodcast ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
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
