import type { CatalogMediaItem } from './mediaCatalog';
import { estimateMoodTags, stripHtml } from './podcastService';

const LIST_TTL = 30 * 60_000;
const DETAILS_TTL = 6 * 60 * 60_000;
const FAILURE_TTL = 60_000;
const CACHE_LIMIT = 400;
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

// Store pending requests as well, so simultaneous searches share the same fetch.
export function cachedCatalogRequest<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.value as Promise<T>;

  const entry = { expires: Infinity, value: Promise.resolve().then(load) };
  cache.delete(key);
  cache.set(key, entry);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  entry.value.then(
    () => { entry.expires = Date.now() + ttl; },
    () => { entry.expires = Date.now() + FAILURE_TTL; },
  );
  return entry.value;
}

async function getJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Catalog provider returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

type VideoFormat = 'movie' | 'tv';
type Named = { name: string };
type WatchProvider = { provider_id: number; provider_name: string };
interface TmdbTitle {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  genres?: Named[];
  runtime?: number;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number };
  number_of_episodes?: number;
  created_by?: Named[];
  credits?: { crew?: Array<Named & { job: string }> };
}
interface WatchProviders {
  results?: Record<string, { link?: string; flatrate?: WatchProvider[]; free?: WatchProvider[]; ads?: WatchProvider[] }>;
}

export function normalizeProvider(name: string): string {
  const key = name.toLowerCase().trim();
  if (['max', 'hbo max'].includes(key)) return 'hbo max';
  if (['prime video', 'amazon prime video'].includes(key)) return 'amazon prime video';
  if (['apple tv', 'apple tv+'].includes(key)) return 'apple tv+';
  return key;
}

function tmdb<T>(path: string, params: Record<string, string>, ttl: number): Promise<T> {
  const query = new URLSearchParams(params);
  query.sort();
  const key = process.env.TMDB_API_KEY;
  if (!key) return Promise.reject(new Error('TMDB_API_KEY is missing'));
  return cachedCatalogRequest(`tmdb:${path}?${query}`, ttl, () => {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.search = query.toString();
    url.searchParams.set('api_key', key);
    return getJson<T>(url);
  });
}

export function mapTmdbTitle(
  format: VideoFormat,
  item: TmdbTitle,
  availability?: WatchProviders,
): CatalogMediaItem | undefined {
  const title = (item.title ?? item.name)?.trim();
  if (!title || !Number.isInteger(item.id) || item.id <= 0) return undefined;
  const region = availability?.results?.US;
  const genres = (item.genres ?? []).map(({ name }) => name).filter(Boolean);
  const providers = [...(region?.flatrate ?? []), ...(region?.free ?? []), ...(region?.ads ?? [])];
  const providerUrl = region?.link?.startsWith('https://www.themoviedb.org/') ? region.link : undefined;
  const runtime = format === 'movie'
    ? item.runtime
    : item.episode_run_time?.find((value) => value > 0) ?? item.last_episode_to_air?.runtime;

  return {
    id: `tmdb_${format}_${item.id}`,
    catalogId: String(item.id),
    source: 'tmdb',
    mediaType: format,
    title,
    creator: format === 'movie'
      ? item.credits?.crew?.find(({ job }) => job === 'Director')?.name ?? ''
      : (item.created_by ?? []).map(({ name }) => name).join(', '),
    releaseYear: (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
    backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
    genres,
    runtimeMinutes: runtime && runtime > 0 ? runtime : undefined,
    episodeCount: item.number_of_episodes,
    overview: item.overview ?? '',
    streamingProviders: [...new Set(providers.map(({ provider_name }) => provider_name))],
    providerUrl,
    catalogOrigin: 'live',
    moodTags: estimateMoodTags(genres),
  };
}

export async function loadTmdbTitles(
  format: VideoFormat,
  search: string,
  services: string[],
  maxDurationMinutes?: number,
): Promise<CatalogMediaItem[]> {
  const params: Record<string, string> = { language: 'en-US', include_adult: 'false' };
  if (search) {
    params.query = search;
  } else {
    params.sort_by = 'popularity.desc';
    if (maxDurationMinutes) params['with_runtime.lte'] = String(maxDurationMinutes);
    if (services.length) {
      const { results } = await tmdb<{ results: WatchProvider[] }>(
        `watch/providers/${format}`, { watch_region: 'US', language: 'en-US' }, DETAILS_TTL,
      );
      const selected = new Set(services.map(normalizeProvider));
      const ids = results.filter(({ provider_name }) => selected.has(normalizeProvider(provider_name)))
        .map(({ provider_id }) => provider_id);
      if (!ids.length) return [];
      params.watch_region = 'US';
      params.with_watch_providers = ids.join('|');
      params.with_watch_monetization_types = 'flatrate|free|ads';
    }
  }

  const { results } = await tmdb<{ results: TmdbTitle[] }>(
    `${search ? 'search' : 'discover'}/${format}`, params, LIST_TTL,
  );
  const items = await Promise.all(results.slice(0, 8).map(async (summary) => {
    const [details, availability] = await Promise.allSettled([
      tmdb<TmdbTitle>(`${format}/${summary.id}`, { language: 'en-US', append_to_response: 'credits' }, DETAILS_TTL),
      tmdb<WatchProviders>(`${format}/${summary.id}/watch/providers`, {}, DETAILS_TTL),
    ]);
    if (availability.status === 'rejected' && services.length) return undefined;
    return mapTmdbTitle(format, details.status === 'fulfilled' ? { ...summary, ...details.value } : summary,
      availability.status === 'fulfilled' ? availability.value : undefined);
  }));
  if (results.length && items.every((item) => !item)) throw new Error('TMDB title details or availability unavailable');
  return items.filter((item): item is CatalogMediaItem => !!item);
}

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    categories?: string[];
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export function mapGoogleVolume({ id, volumeInfo }: GoogleVolume): CatalogMediaItem | undefined {
  if (!id || !volumeInfo?.title?.trim()) return undefined;
  const genres = (volumeInfo.categories ?? []).flatMap((value) => value.split(/\s*\/\s*/)).filter(Boolean);
  const pageCount = volumeInfo.pageCount && volumeInfo.pageCount > 0 ? volumeInfo.pageCount : undefined;
  const image = volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail ?? '';
  return {
    id: `google_books_${id}`,
    catalogId: id,
    source: 'google_books',
    mediaType: 'book',
    title: volumeInfo.title.trim(),
    creator: (volumeInfo.authors ?? []).join(', '),
    releaseYear: (volumeInfo.publishedDate ?? '').slice(0, 4),
    posterUrl: image.replace(/^http:/, 'https:'),
    genres,
    overview: stripHtml(volumeInfo.description),
    pageCount,
    catalogOrigin: 'live',
    moodTags: estimateMoodTags(genres),
  };
}

export async function loadGoogleBooks(query: string): Promise<CatalogMediaItem[]> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (!key) throw new Error('GOOGLE_BOOKS_API_KEY is missing');
  return cachedCatalogRequest(`books:${query.toLowerCase()}`, LIST_TTL, async () => {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.search = new URLSearchParams({
      q: query, key, maxResults: '20', printType: 'books', langRestrict: 'en',
    }).toString();
    const data = await getJson<{ items?: GoogleVolume[] }>(url);
    return (data.items ?? []).map(mapGoogleVolume).filter((item): item is CatalogMediaItem => !!item);
  });
}
