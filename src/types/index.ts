export type MediaType = 'movie' | 'tv' | 'book' | 'podcast';

export interface RatedTitleFeedback {
  title: string;
  mediaType: MediaType;
  genres: string[];
}

export interface RecommendationRatingFeedback {
  liked: RatedTitleFeedback[];
  disliked: RatedTitleFeedback[];
}

export interface CatalogDisplayMetadata {
  pageCount?: number;
  providerUrl?: string;
  catalogOrigin?: 'live' | 'fallback';
}

export interface MoodSettings {
  darkness: number;          // 1 (Light & uplifting) - 5 (Dark & intense)
  romance: number;           // 1 (No romance) - 5 (Romance-heavy)
  suspense: number;          // 1 (Relaxed & predictable) - 5 (Extremely suspenseful)
  plotTwists: number;        // 1 (Straightforward) - 5 (Full of surprises)
  emotionalIntensity: number;// 1 (Comforting & easygoing) - 5 (Emotionally intense)
}

export interface TasteProfile {
  preferredGenres: string[];
  preferredFormats: MediaType[];
  favoriteStories: string[];
  storyElements: string[];
  dislikedGenres: string[];
  timeAvailability: string;
  streamingServices: string[];
  aiTasteSummary?: string;
  updatedAt?: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  onboardingCompleted: boolean;
  tasteProfile?: TasteProfile;
  createdAt: string;
  updatedAt: string;
}

export interface SavedMediaItem {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: MediaType;
  title: string;
  posterUrl: string;
  creator?: string;
  releaseYear?: string;
  genres: string[];
  status: 'watchlist' | 'completed' | 'reading' | 'watching' | 'listening' | 'passed';
  rating?: 'liked' | 'disliked' | 'neutral' | 'none';
  userNotes?: string;
  source: 'tmdb' | 'google_books' | 'podcast' | 'scan';
  runtimeMinutes?: number;
  streamingProviders?: string[];
  overview?: string;
  aiExplanation?: string;
  compatibilityScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SwipeDecisionRecord {
  id: string;
  userId: string;
  mediaId: string;
  title: string;
  posterUrl: string;
  mediaType: 'movie';
  decision: 'interested' | 'pass';
  feedbackStatus: 'active' | 'reversed';
  genres: string[];
  createdAt: string;
}

export interface MovieSwipeCard {
  id: string;
  title: string;
  releaseYear: string;
  posterUrl: string;
  backdropUrl?: string;
  genres: string[];
  runtimeMinutes?: number;
  overview: string;
  aiExplanation: string;
  compatibilityScore: number;
  streamingProviders?: string[];
  director?: string;
  cast?: string[];
}

export interface GroupItem {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}
