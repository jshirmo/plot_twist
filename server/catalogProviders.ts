import type { MoodSettings, TasteProfile } from '../src/types';
import type { CatalogMediaItem } from './mediaCatalog';

export interface CatalogRequest {
  mood: MoodSettings;
  taste: TasteProfile;
  formats: CatalogMediaItem['mediaType'][];
  maxDurationMinutes?: number;
  streamingServices?: string[];
  availabilityRegion: string;
  excludedMediaIds?: string[];
}

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
};

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const CANDIDATES_PER_SOURCE = 16;

function moodTagsFromGenres(genres: string[], mood: MoodSettings) {
  const text = genres.join(' ').toLowerCase();
  const has = (words: string[]) => words.some((word) => text.includes(word));
  return {
    darkness: has(['horror', 'thriller', 'crime', 'mystery']) ? 4 : mood.darkness,
    romance: has(['romance', 'love']) ? 4 : 1,
    suspense: has(['thriller', 'mystery', 'crime', 'horror']) ? 4 : 2,
    plotTwists: has(['mystery', 'thriller', 'science fiction', 'fantasy']) ? 4 : 2,
    emotionalIntensity: has(['drama', 'romance', 'biography', 'documentary']) ? 4 : 2,
  };
}

function queryTerms(taste: TasteProfile, mood: MoodSettings): string {
  const genres = taste.preferredGenres.filter(Boolean).slice(0, 2);
  if (genres.length > 0) return genres.join(' ');
  if (mood.suspense >= 4 || mood.plotTwists >= 4) return 'mystery thriller';
  if (mood.romance >= 4) return 'romance drama';
  return 'drama';
}

function providerMatches(providers: string[], wanted?: string[]) {
  if (!wanted?.length) return true;
  return providers.some((provider) => wanted.some((service) => provider.toLowerCase() === service.toLowerCase()));
}

function acceptsCandidate(candidate: CatalogMediaItem, request: CatalogRequest): boolean {
  if (request.excludedMediaIds?.includes(candidate.id)) return false;
  if (request.maxDurationMinutes && request.maxDurationMinutes > 0) {
    // Do not estimate reading or listening time. A candidate without a verified duration
    // is excluded when the user asks for a runtime limit.
    if (!candidate.runtimeMinutes || candidate.runtimeMinutes > request.maxDurationMinutes) return false;
  }
  if ((candidate.mediaType === 'movie' || candidate.mediaType === 'tv' || candidate.mediaType === 'podcast') &&
      !providerMatches(candidate.streamingProviders ?? [], request.streamingServices)) return false;
  return true;
}

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tmdb(path: string): Promise<unknown> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  const apiKey = process.env.TMDB_API_KEY;
  if (apiKey) url.searchParams.set('api_key', apiKey);
  const response = await fetch(url, { headers: tmdbHeaders(), signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`TMDB request failed (${response.status})`);
  return response.json();
}

async function tmdbGenres(type: 'movie' | 'tv'): Promise<Map<number, string>> {
  const data = await tmdb(`/genre/${type}/list`) as { genres?: Array<{ id: number; name: string }> };
  return new Map((data.genres ?? []).map((genre) => [genre.id, genre.name]));
}

async function tmdbProviders(type: 'movie' | 'tv', id: number, region: string): Promise<string[]> {
  const data = await tmdb(`/${type}/${id}/watch/providers`) as {
    results?: Record<string, { flatrate?: Array<{ provider_name: string }> }>;
  };
  return data.results?.[region]?.flatrate?.map((provider) => provider.provider_name) ?? [];
}

async function fetchTmdbCandidates(type: 'movie' | 'tv', request: CatalogRequest): Promise<CatalogMediaItem[]> {
  if (!process.env.TMDB_API_KEY && !process.env.TMDB_API_READ_ACCESS_TOKEN) return [];
  const [genreMap, discover] = await Promise.all([
    tmdbGenres(type),
    tmdb(`/discover/${type}?include_adult=false&sort_by=popularity.desc&page=1`),
  ]);
  const results = (discover as { results?: TmdbItem[] }).results ?? [];
  const candidates = await Promise.all(results.slice(0, CANDIDATES_PER_SOURCE).map(async (item) => {
    try {
      const [details, providers] = await Promise.all([
        tmdb(`/${type}/${item.id}?append_to_response=credits`),
        tmdbProviders(type, item.id, request.availabilityRegion),
      ]);
      const full = details as Record<string, unknown>;
      const genres = Array.isArray(full.genres)
        ? full.genres.map((genre) => (genre as { name?: string }).name).filter((name): name is string => Boolean(name))
        : (item.genre_ids ?? []).map((id) => genreMap.get(id)).filter((name): name is string => Boolean(name));
      const crew = (full.credits as { crew?: Array<{ job?: string; name?: string }> } | undefined)?.crew ?? [];
      const creators = type === 'tv'
        ? ((full.created_by as Array<{ name?: string }> | undefined) ?? []).map((creator) => creator.name).filter(Boolean).join(', ')
        : crew.find((person) => person.job === 'Director')?.name;
      const runtime = type === 'movie'
        ? Number(full.runtime) || undefined
        : Number((full.episode_run_time as number[] | undefined)?.[0]) || undefined;
      const title = String(type === 'movie' ? full.title ?? item.title ?? '' : full.name ?? item.name ?? '');
      if (!title) return null;
      const candidate: CatalogMediaItem = {
        id: `tmdb:${type}:${item.id}`,
        catalogId: String(item.id),
        source: 'tmdb',
        mediaType: type,
        title,
        creator: creators || 'Unknown creator',
        releaseYear: String(type === 'movie' ? full.release_date ?? item.release_date ?? '' : full.first_air_date ?? item.first_air_date ?? '').slice(0, 4),
        posterUrl: typeof full.poster_path === 'string' ? `${TMDB_IMAGE}${full.poster_path}` : '',
        genres,
        runtimeMinutes: runtime,
        overview: String(full.overview ?? item.overview ?? ''),
        streamingProviders: providers,
        moodTags: moodTagsFromGenres(genres, request.mood),
      };
      return acceptsCandidate(candidate, request) ? candidate : null;
    } catch {
      return null;
    }
  }));
  return candidates.filter((item): item is CatalogMediaItem => Boolean(item));
}

async function fetchBookCandidates(request: CatalogRequest): Promise<CatalogMediaItem[]> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `subject:${queryTerms(request.taste, request.mood)}`);
  url.searchParams.set('printType', 'books');
  url.searchParams.set('maxResults', String(CANDIDATES_PER_SOURCE));
  url.searchParams.set('country', request.availabilityRegion);
  if (process.env.GOOGLE_BOOKS_API_KEY) url.searchParams.set('key', process.env.GOOGLE_BOOKS_API_KEY);
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`Google Books request failed (${response.status})`);
  const data = await response.json() as { items?: Array<{ id?: string; volumeInfo?: Record<string, unknown> }> };
  return (data.items ?? []).flatMap((item) => {
    const info = item.volumeInfo ?? {};
    if (!item.id || typeof info.title !== 'string') return [];
    const genres = Array.isArray(info.categories) ? info.categories.filter((genre): genre is string => typeof genre === 'string') : [];
    const imageLinks = info.imageLinks as { thumbnail?: string } | undefined;
    const candidate: CatalogMediaItem = {
      id: `google-books:${item.id}`,
      catalogId: item.id,
      source: 'google_books',
      mediaType: 'book',
      title: info.title,
      creator: Array.isArray(info.authors) ? info.authors.filter((author): author is string => typeof author === 'string').join(', ') : 'Unknown author',
      releaseYear: typeof info.publishedDate === 'string' ? info.publishedDate.slice(0, 4) : '',
      posterUrl: imageLinks?.thumbnail?.replace('http:', 'https:') ?? '',
      genres,
      pageCount: typeof info.pageCount === 'number' ? info.pageCount : undefined,
      overview: typeof info.description === 'string' ? info.description.slice(0, 1200) : '',
      moodTags: moodTagsFromGenres(genres, request.mood),
    };
    return acceptsCandidate(candidate, request) ? [candidate] : [];
  });
}

async function fetchPodcastCandidates(request: CatalogRequest): Promise<CatalogMediaItem[]> {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', queryTerms(request.taste, request.mood));
  url.searchParams.set('media', 'podcast');
  url.searchParams.set('entity', 'podcast');
  url.searchParams.set('country', request.availabilityRegion);
  url.searchParams.set('limit', String(CANDIDATES_PER_SOURCE));
  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`Apple Podcasts catalog request failed (${response.status})`);
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).flatMap((item) => {
    const catalogId = item.collectionId ?? item.trackId;
    const title = item.collectionName ?? item.trackName;
    if ((typeof catalogId !== 'number' && typeof catalogId !== 'string') || typeof title !== 'string') return [];
    const genres = Array.isArray(item.genres) ? item.genres.filter((genre): genre is string => typeof genre === 'string') :
      typeof item.primaryGenreName === 'string' ? [item.primaryGenreName] : [];
    const candidate: CatalogMediaItem = {
      id: `apple-podcasts:${catalogId}`,
      catalogId: String(catalogId),
      source: 'podcast',
      mediaType: 'podcast',
      title,
      creator: typeof item.artistName === 'string' ? item.artistName : 'Unknown creator',
      releaseYear: typeof item.releaseDate === 'string' ? item.releaseDate.slice(0, 4) : '',
      posterUrl: typeof item.artworkUrl600 === 'string' ? item.artworkUrl600 : typeof item.artworkUrl100 === 'string' ? item.artworkUrl100 : '',
      genres,
      // Apple does not give a verified episode runtime in this public catalog response.
      overview: typeof item.description === 'string' ? item.description.slice(0, 1200) : '',
      streamingProviders: typeof item.collectionViewUrl === 'string' ? ['Apple Podcasts'] : [],
      moodTags: moodTagsFromGenres(genres, request.mood),
    };
    return acceptsCandidate(candidate, request) ? [candidate] : [];
  });
}

export async function retrieveVerifiedCandidates(request: CatalogRequest): Promise<CatalogMediaItem[]> {
  const providers: Array<Promise<CatalogMediaItem[]>> = [];
  if (request.formats.includes('movie')) providers.push(fetchTmdbCandidates('movie', request));
  if (request.formats.includes('tv')) providers.push(fetchTmdbCandidates('tv', request));
  if (request.formats.includes('book')) providers.push(fetchBookCandidates(request));
  if (request.formats.includes('podcast')) providers.push(fetchPodcastCandidates(request));
  const settled = await Promise.allSettled(providers);
  const candidates = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  return [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
}
