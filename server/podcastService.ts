// Podcast catalog powered by the Podcast Index API (https://podcastindex-org.github.io/docs-api/).
// Owner: Chloe. Ben's catalog can call getPodcastCandidates() to get real podcasts in the
// same CatalogMediaItem shape the rest of the app already uses.
//
// Uses Podcast Index when PODCAST_INDEX_KEY and PODCAST_INDEX_SECRET are set in .env.
// Without them it uses Apple Podcasts (applePodcasts.ts, no key needed), and if that fails,
// the fixed podcasts in mediaCatalog.ts.

import { createHash } from 'crypto';
import { CatalogMediaItem, VERIFIED_CATALOG } from './mediaCatalog';
import { appleSearchPodcasts, appleTopPodcasts, appleEpisodes } from './applePodcasts';

const API_BASE = 'https://api.podcastindex.org/api/1.0';
const USER_AGENT = 'PlotTwist/1.0 (DATA 2150 class project)';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REQUEST_TIMEOUT_MS = 8000;

// Extra podcast-only fields. Everything else matches CatalogMediaItem.
export interface PodcastCatalogItem extends CatalogMediaItem {
  feedUrl?: string;
  websiteUrl?: string;
  appleUrl?: string;
  language?: string;
  lastEpisodeDate?: string;
  moodTagsEstimated?: boolean;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationMinutes?: number;
  audioUrl?: string;
  imageUrl?: string;
  link?: string;
}

// Raw shapes we read from Podcast Index (only the fields we use).
interface RawFeed {
  id: number;
  title?: string;
  author?: string;
  ownerName?: string;
  description?: string;
  image?: string;
  artwork?: string;
  url?: string;
  link?: string;
  language?: string;
  itunesId?: number | null;
  episodeCount?: number;
  newestItemPublishTime?: number;
  lastUpdateTime?: number;
  categories?: Record<string, string> | null;
}

interface RawEpisode {
  id: number;
  title?: string;
  description?: string;
  datePublished?: number;
  duration?: number | null;
  enclosureUrl?: string;
  image?: string;
  feedImage?: string;
  link?: string;
}

// ---------- Setup ----------

export function isPodcastIndexConfigured(): boolean {
  return Boolean(process.env.PODCAST_INDEX_KEY && process.env.PODCAST_INDEX_SECRET);
}

function authHeaders(): Record<string, string> {
  const key = process.env.PODCAST_INDEX_KEY as string;
  const secret = process.env.PODCAST_INDEX_SECRET as string;
  const date = Math.floor(Date.now() / 1000).toString();
  const signature = createHash('sha1').update(key + secret + date).digest('hex');
  return {
    'User-Agent': USER_AGENT,
    'X-Auth-Key': key,
    'X-Auth-Date': date,
    Authorization: signature,
  };
}

// ---------- Cache ----------

const cache = new Map<string, { expires: number; value: unknown }>();

function fromCache<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function toCache(key: string, value: unknown) {
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

async function podcastIndexGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') query.set(k, String(v));
  }
  const url = `${API_BASE}${path}?${query.toString()}`;

  const cached = fromCache<T>(url);
  if (cached) return cached;

  const res = await fetch(url, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Podcast Index ${path} failed with status ${res.status}`);
  }
  const data = (await res.json()) as T;
  toCache(url, data);
  return data;
}

// ---------- Mapping ----------

export function stripHtml(text = ''): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max = 400): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')).trim() + '…';
}

// Rough mood estimate from a podcast's categories, so podcasts work with the mood sliders.
// Ben's Gemini step can refine these; moodTagsEstimated marks them as guesses.
const MOOD_HINTS: Array<{ match: RegExp; tags: Partial<CatalogMediaItem['moodTags']> }> = [
  { match: /true crime|crime|criminal/i, tags: { darkness: 4, suspense: 4, plotTwists: 4, emotionalIntensity: 4 } },
  { match: /horror|paranormal|supernatural/i, tags: { darkness: 5, suspense: 4, plotTwists: 3 } },
  { match: /mystery|thriller|investigat/i, tags: { suspense: 4, plotTwists: 4, darkness: 3 } },
  { match: /drama|fiction|storytelling|audio drama/i, tags: { plotTwists: 3, emotionalIntensity: 3, suspense: 3 } },
  { match: /romance|relationships|dating|sexuality/i, tags: { romance: 4, emotionalIntensity: 3 } },
  { match: /comedy|improv|humor/i, tags: { darkness: 1, suspense: 1, emotionalIntensity: 1 } },
  { match: /history/i, tags: { darkness: 3, suspense: 2, plotTwists: 2 } },
  { match: /news|politics/i, tags: { darkness: 3, suspense: 2, emotionalIntensity: 3 } },
  { match: /health|fitness|self-improvement|education|science|business/i, tags: { darkness: 1, suspense: 1, plotTwists: 1 } },
  { match: /society|culture|personal journals|documentary/i, tags: { emotionalIntensity: 3, darkness: 2 } },
];

export function estimateMoodTags(genres: string[]): CatalogMediaItem['moodTags'] {
  const tags = { darkness: 2, romance: 1, suspense: 2, plotTwists: 2, emotionalIntensity: 2 };
  const text = genres.join(' ');
  for (const hint of MOOD_HINTS) {
    if (hint.match.test(text)) {
      for (const [k, v] of Object.entries(hint.tags) as Array<[keyof typeof tags, number]>) {
        tags[k] = Math.max(tags[k], v);
      }
    }
  }
  return tags;
}

function yearFromUnix(seconds?: number): string {
  return seconds ? new Date(seconds * 1000).getUTCFullYear().toString() : '';
}

export function mapFeedToCatalogItem(feed: RawFeed): PodcastCatalogItem {
  const genres = Object.values(feed.categories || {}).filter(Boolean).slice(0, 4);
  const lastPublished = feed.newestItemPublishTime || feed.lastUpdateTime;
  const providers = ['Podcast apps'];
  if (feed.itunesId) providers.unshift('Apple Podcasts');

  return {
    id: `pod_pi_${feed.id}`,
    catalogId: String(feed.id),
    source: 'podcast',
    mediaType: 'podcast',
    title: stripHtml(feed.title) || 'Untitled podcast',
    creator: stripHtml(feed.author || feed.ownerName) || 'Unknown host',
    // Podcast Index doesn't give a start year, so this is the year of the latest episode.
    releaseYear: yearFromUnix(lastPublished),
    posterUrl: feed.artwork || feed.image || '',
    genres: genres.length ? genres : ['Podcast'],
    overview: truncate(stripHtml(feed.description)),
    streamingProviders: providers,
    episodeCount: feed.episodeCount,
    moodTags: estimateMoodTags(genres),
    moodTagsEstimated: true,
    feedUrl: feed.url,
    websiteUrl: feed.link,
    appleUrl: feed.itunesId ? `https://podcasts.apple.com/podcast/id${feed.itunesId}` : undefined,
    language: feed.language,
    lastEpisodeDate: lastPublished ? new Date(lastPublished * 1000).toISOString() : undefined,
  };
}

function mapEpisode(ep: RawEpisode): PodcastEpisode {
  return {
    id: String(ep.id),
    title: stripHtml(ep.title) || 'Untitled episode',
    description: truncate(stripHtml(ep.description), 300),
    publishedAt: ep.datePublished ? new Date(ep.datePublished * 1000).toISOString() : '',
    durationMinutes: ep.duration ? Math.round(ep.duration / 60) : undefined,
    audioUrl: ep.enclosureUrl,
    imageUrl: ep.image || ep.feedImage,
    link: ep.link,
  };
}

// Skip feeds that would look broken in the app (no art, no title, or dead for 3+ years).
function isUsable(item: PodcastCatalogItem): boolean {
  if (!item.title || !item.posterUrl) return false;
  if (item.lastEpisodeDate) {
    const threeYears = 3 * 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - Date.parse(item.lastEpisodeDate) > threeYears) return false;
  }
  return true;
}

// ---------- Fallback ----------

export function fallbackPodcasts(term?: string): PodcastCatalogItem[] {
  const fixed = VERIFIED_CATALOG.filter((i) => i.mediaType === 'podcast');
  if (!term) return fixed;
  const t = term.toLowerCase();
  const matches = fixed.filter((i) =>
    [i.title, i.creator, ...i.genres].some((field) => field.toLowerCase().includes(t))
  );
  return matches.length ? matches : fixed;
}

// ---------- Public functions ----------
// Order: Podcast Index (if its keys are set) -> Apple Podcasts (no key needed) -> fixed list.

export function podcastSource(): 'podcastindex' | 'apple' {
  return isPodcastIndexConfigured() ? 'podcastindex' : 'apple';
}

async function fromApple<T>(label: string, load: () => Promise<T[]>, fallback: () => T[]): Promise<T[]> {
  try {
    const items = await load();
    return items.length ? items : fallback();
  } catch (err) {
    console.error(`Apple Podcasts ${label} failed, using fallback:`, (err as Error).message);
    return fallback();
  }
}

export async function searchPodcasts(term: string, max = 20): Promise<PodcastCatalogItem[]> {
  const q = term.trim().slice(0, 100);
  if (!q) return getTrendingPodcasts(max);
  if (!isPodcastIndexConfigured()) {
    return fromApple('search', () => appleSearchPodcasts(q, max), () => fallbackPodcasts(q).slice(0, max));
  }
  try {
    const data = await podcastIndexGet<{ feeds?: RawFeed[] }>('/search/byterm', {
      q,
      max: Math.min(max * 2, 60), // over-fetch, since some feeds get filtered out
    });
    const items = (data.feeds || []).map(mapFeedToCatalogItem).filter(isUsable);
    return items.length ? items.slice(0, max) : fallbackPodcasts(q);
  } catch (err) {
    console.error('Podcast search failed, trying Apple:', (err as Error).message);
    return fromApple('search', () => appleSearchPodcasts(q, max), () => fallbackPodcasts(q).slice(0, max));
  }
}

export async function getTrendingPodcasts(max = 20, category?: string): Promise<PodcastCatalogItem[]> {
  if (!isPodcastIndexConfigured()) {
    return fromApple('top chart', () => appleTopPodcasts(max, category), () => fallbackPodcasts().slice(0, max));
  }
  try {
    const data = await podcastIndexGet<{ feeds?: RawFeed[] }>('/podcasts/trending', {
      max: Math.min(max * 2, 60),
      lang: 'en',
      cat: category,
    });
    const items = (data.feeds || []).map(mapFeedToCatalogItem).filter(isUsable);
    return items.length ? items.slice(0, max) : fallbackPodcasts();
  } catch (err) {
    console.error('Trending podcasts failed, trying Apple:', (err as Error).message);
    return fromApple('top chart', () => appleTopPodcasts(max, category), () => fallbackPodcasts().slice(0, max));
  }
}

export async function getPodcastEpisodes(feedId: string, max = 10): Promise<PodcastEpisode[]> {
  if (!/^\d+$/.test(feedId)) return [];
  if (!isPodcastIndexConfigured()) {
    return fromApple('episodes', () => appleEpisodes(feedId, max), () => []);
  }
  try {
    const data = await podcastIndexGet<{ items?: RawEpisode[] }>('/episodes/byfeedid', {
      id: feedId,
      max: Math.min(max, 50),
    });
    return (data.items || []).map(mapEpisode);
  } catch (err) {
    console.error('Podcast episodes failed:', (err as Error).message);
    return [];
  }
}

/**
 * For Ben's catalog: real podcasts to use as recommendation candidates.
 * Searches each preferred genre/term, adds trending shows, and de-duplicates.
 * Always returns something (falls back to the fixed podcasts).
 */
export async function getPodcastCandidates(options: { terms?: string[]; max?: number } = {}): Promise<PodcastCatalogItem[]> {
  const max = options.max ?? 30;
  const terms = (options.terms || []).map((t) => t.trim()).filter(Boolean).slice(0, 4);

  const batches = await Promise.all([
    ...terms.map((t) => searchPodcasts(t, 10)),
    getTrendingPodcasts(15),
  ]);

  const seen = new Set<string>();
  const merged: PodcastCatalogItem[] = [];
  for (const item of batches.flat()) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.slice(0, max);
}
