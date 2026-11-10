import type { RatedTitleFeedback, RecommendationRatingFeedback } from '../src/types';
import type { CatalogMediaItem } from './mediaCatalog';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const mediaTypes = new Set(['movie', 'tv', 'book', 'podcast']);

export function parseRatingFeedback(value: unknown): RecommendationRatingFeedback | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { liked, disliked } = value as Record<string, unknown>;

  function readTitles(entries: unknown): RatedTitleFeedback[] {
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry): RatedTitleFeedback[] => {
      if (!entry || typeof entry !== 'object') return [];
      const { title, mediaType, genres } = entry as Record<string, unknown>;
      if (typeof title !== 'string' || !title.trim() || typeof mediaType !== 'string' || !mediaTypes.has(mediaType)) {
        return [];
      }
      return [{
        title: title.trim(),
        mediaType: mediaType as RatedTitleFeedback['mediaType'],
        genres: Array.isArray(genres)
          ? genres.filter((genre): genre is string => typeof genre === 'string' && !!genre.trim())
          : [],
      }];
    });
  }

  return { liked: readTitles(liked), disliked: readTitles(disliked) };
}

export function excludeDislikedTitles(
  candidates: CatalogMediaItem[],
  feedback?: RecommendationRatingFeedback,
): CatalogMediaItem[] {
  const key = (item: Pick<RatedTitleFeedback, 'title' | 'mediaType'>) =>
    JSON.stringify([item.mediaType, normalize(item.title)]);
  const blocked = new Set(feedback?.disliked.map(key));
  return candidates.filter((item) => !blocked.has(key(item)));
}

export function ratingGenreSignals(feedback?: RecommendationRatingFeedback) {
  return {
    liked: new Set(feedback?.liked.flatMap((item) => item.genres.map(normalize))),
    disliked: new Set(feedback?.disliked.flatMap((item) => item.genres.map(normalize))),
  };
}
