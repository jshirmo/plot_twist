// Apple Podcasts data (iTunes Search API + Apple's top-podcasts chart). Owner: Chloe.
// Free and needs no API key, so podcast search works even without Podcast Index keys.
// Docs: https://performance-partners.apple.com/search-api
// Apple asks apps to stay around 20 requests per minute, so every result is cached.

import type { CatalogMediaItem } from './mediaCatalog';
import type { PodcastCatalogItem, PodcastEpisode } from './podcastService';

const SEARCH_URL = 'https://itunes.apple.com/search';
const LOOKUP_URL = 'https://itunes.apple.com/lookup';
const TOP_URL = 'https://rss.applemarketingtools.com/api/v2/us/podcasts/top';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REQUEST_TIMEOUT_MS = 8000;

// Only the fields we read.
interface RawApplePodcast {
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
  feedUrl?: string;
  collectionViewUrl?: string;
  trackViewUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  releaseDate?: string;
  trackCount?: number;
  primaryGenreName?: string;
  genres?: string[];
}

interface RawAppleEpisode {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  description?: string;
  shortDescription?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
  episodeUrl?: string;
  artworkUrl600?: string;
  artworkUrl160?: string;
  trackViewUrl?: string;
}

interface RawTopPodcast {
  id?: string;
  name?: string;
  artistName?: string;
  artworkUrl100?: string;
  url?: string;
  genres?: Array<{ name?: string } | string>;
}

const cache = new Map<string, { expires: number; value: unknown }>();

async function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Apple Podcasts request failed with status ${res.status}`);
  const data = (await res.json()) as T;
  cache.set(url, { expires: Date.now() + CACHE_TTL_MS, value: data });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return data;
}

// Apple artwork URLs end in a size like ".../100x100bb.jpg"; ask for a bigger one.
export function biggerArtwork(url = ''): string {
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/i, '/600x600bb.$2');
}

// Same idea as podcastService's estimate; kept here so this file has no runtime import cycle.
function estimateMood(genres: string[]): CatalogMediaItem['moodTags'] {
  const tags = { darkness: 2, romance: 1, suspense: 2, plotTwists: 2, emotionalIntensity: 2 };
  const text = genres.join(' ').toLowerCase();
  const bump = (k: keyof typeof tags, v: number) => (tags[k] = Math.max(tags[k], v));
  if (/true crime|crime/.test(text)) { bump('darkness', 4); bump('suspense', 4); bump('plotTwists', 4); bump('emotionalIntensity', 4); }
  if (/horror|paranormal/.test(text)) { bump('darkness', 5); bump('suspense', 4); }
  if (/mystery|thriller|investigat|documentary/.test(text)) { bump('suspense', 4); bump('plotTwists', 4); bump('darkness', 3); }
  if (/fiction|drama|storytelling/.test(text)) { bump('plotTwists', 3); bump('emotionalIntensity', 3); }
  if (/relationships|romance/.test(text)) { bump('romance', 4); bump('emotionalIntensity', 3); }
  if (/history|news|politics/.test(text)) { bump('darkness', 3); }
  if (/society|culture|personal journals/.test(text)) { bump('emotionalIntensity', 3); }
  return tags;
}

export function mapApplePodcast(p: RawApplePodcast): PodcastCatalogItem | null {
  const id = p.collectionId ?? p.trackId;
  const title = p.collectionName || p.trackName;
  if (!id || !title) return null;
  const genres = (p.genres || []).filter((g) => g && g !== 'Podcasts').slice(0, 4);
  if (!genres.length && p.primaryGenreName) genres.push(p.primaryGenreName);
  const host = p.artistName || 'Unknown host';
  return {
    id: `pod_ap_${id}`,
    catalogId: String(id),
    source: 'podcast',
    mediaType: 'podcast',
    title,
    creator: host,
    // Apple gives the latest episode date, not the start year.
    releaseYear: p.releaseDate ? String(new Date(p.releaseDate).getUTCFullYear()) : '',
    posterUrl: p.artworkUrl600 || biggerArtwork(p.artworkUrl100),
    genres: genres.length ? genres : ['Podcast'],
    overview: `${genres[0] || 'A'} podcast from ${host}.`,
    streamingProviders: ['Apple Podcasts', 'Podcast apps'],
    episodeCount: p.trackCount,
    moodTags: estimateMood(genres),
    moodTagsEstimated: true,
    feedUrl: p.feedUrl,
    appleUrl: p.collectionViewUrl || p.trackViewUrl,
    lastEpisodeDate: p.releaseDate,
  };
}

export function mapTopPodcast(p: RawTopPodcast): PodcastCatalogItem | null {
  if (!p.id || !p.name) return null;
  const genres = (p.genres || [])
    .map((g) => (typeof g === 'string' ? g : g?.name || ''))
    .filter((g) => g && g !== 'Podcasts')
    .slice(0, 4);
  const host = p.artistName || 'Unknown host';
  return {
    id: `pod_ap_${p.id}`,
    catalogId: p.id,
    source: 'podcast',
    mediaType: 'podcast',
    title: p.name,
    creator: host,
    releaseYear: '',
    posterUrl: biggerArtwork(p.artworkUrl100),
    genres: genres.length ? genres : ['Podcast'],
    overview: `A top podcast on Apple Podcasts from ${host}.`,
    streamingProviders: ['Apple Podcasts', 'Podcast apps'],
    moodTags: estimateMood(genres),
    moodTagsEstimated: true,
    appleUrl: p.url,
  };
}

function stripTags(text = ''): string {
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mapAppleEpisode(ep: RawAppleEpisode): PodcastEpisode | null {
  if (!ep.trackId || !ep.trackName) return null;
  const desc = stripTags(ep.shortDescription || ep.description);
  return {
    id: String(ep.trackId),
    title: ep.trackName,
    description: desc.length > 300 ? desc.slice(0, desc.lastIndexOf(' ', 300)) + '…' : desc,
    publishedAt: ep.releaseDate || '',
    durationMinutes: ep.trackTimeMillis ? Math.round(ep.trackTimeMillis / 60000) : undefined,
    audioUrl: ep.episodeUrl,
    imageUrl: ep.artworkUrl600 || ep.artworkUrl160,
    link: ep.trackViewUrl,
  };
}

const notNull = <T,>(x: T | null): x is T => x !== null;

export async function appleSearchPodcasts(term: string, max = 20): Promise<PodcastCatalogItem[]> {
  const params = new URLSearchParams({
    term,
    media: 'podcast',
    entity: 'podcast',
    country: 'US',
    limit: String(Math.min(max, 50)),
  });
  const data = await getJson<{ results?: RawApplePodcast[] }>(`${SEARCH_URL}?${params}`);
  return (data.results || []).map(mapApplePodcast).filter(notNull).filter((p) => p.posterUrl);
}

export async function appleTopPodcasts(max = 20, category?: string): Promise<PodcastCatalogItem[]> {
  // Apple's chart has no genre filter, so a category becomes a search instead.
  if (category) return appleSearchPodcasts(category, max);
  const size = max <= 10 ? 10 : max <= 25 ? 25 : 50;
  const data = await getJson<{ feed?: { results?: RawTopPodcast[] } }>(`${TOP_URL}/${size}/podcasts.json`);
  return (data.feed?.results || []).map(mapTopPodcast).filter(notNull).slice(0, max);
}

export async function appleEpisodes(podcastId: string, max = 10): Promise<PodcastEpisode[]> {
  const params = new URLSearchParams({
    id: podcastId,
    media: 'podcast',
    entity: 'podcastEpisode',
    limit: String(Math.min(max, 50)),
  });
  const data = await getJson<{ results?: RawAppleEpisode[] }>(`${LOOKUP_URL}?${params}`);
  return (data.results || [])
    .filter((r) => r.wrapperType === 'podcastEpisode' || r.kind === 'podcast-episode')
    .map(mapAppleEpisode)
    .filter(notNull)
    .slice(0, max);
}
