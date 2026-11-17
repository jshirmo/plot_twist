// Mood-weighted ranking for Discover. Pure functions only (no network), so the
// slider behavior is easy to test and identical with or without Gemini.
import type { CatalogMediaItem } from './mediaCatalog';
import type { MoodSettings } from '../src/types';
import { MOOD_KEYS, explainMoodFit } from '../src/lib/moodSignal';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface Cue { pattern: RegExp; key: keyof MoodSettings; delta: number }

// Genre and description cues. Live catalog items only carry genre-estimated
// tags, so these sharpen them; each axis moves at most one step either way.
const CUES: Cue[] = [
  { pattern: /\bromance\b|romantic|love story|falls? in love|\blovers?\b|\bdating\b|\bwedding\b|soulmate|courtship/, key: 'romance', delta: 1 },
  { pattern: /murder|\bkiller\b|serial kill|\bwar\b|\bgrim\b|gritty|horror|haunt|violent|revenge|dystop|abduct|kidnap|\bcrime\b|noir|brutal/, key: 'darkness', delta: 1 },
  { pattern: /\bfamily\b|comedy|animation|animated|heartwarming|feel-good|\bkids\b|children|uplifting|musical|\bcozy\b|whimsical|sitcom/, key: 'darkness', delta: -1 },
  { pattern: /thriller|suspense|\bmystery\b|mysteries|\bcrime\b|detective|investigat|psychological|conspiracy|survival|missing|disappear|manhunt/, key: 'suspense', delta: 1 },
  { pattern: /\bcomedy\b|sitcom|\bcozy\b|slice of life|feel-good|meditat|self-help|cookbook/, key: 'suspense', delta: -1 },
  { pattern: /twist|\bmystery\b|mysteries|secret|mind-bending|puzzle|whodunit|psychological|unravel|conspiracy|time travel|hidden truth|not what it seems/, key: 'plotTwists', delta: 1 },
  { pattern: /drama|tragedy|tragic|grief|\bwar\b|trauma|heartbreak|devastat|\bloss\b|emotional|tearjerk|redemption/, key: 'emotionalIntensity', delta: 1 },
  { pattern: /\bcomedy\b|sitcom|\bcozy\b|feel-good|lighthearted|light-hearted|whimsical|\bfun\b/, key: 'emotionalIntensity', delta: -1 },
];

/** The item's mood tags, sharpened with genre and description cues. */
export function refineMoodTags(item: Pick<CatalogMediaItem, 'moodTags' | 'genres' | 'overview'>): MoodSettings {
  const genreText = item.genres.join(' ').toLowerCase();
  const text = `${genreText} ${(item.overview || '').toLowerCase()}`;
  const shift: Record<keyof MoodSettings, number> = { darkness: 0, romance: 0, suspense: 0, plotTwists: 0, emotionalIntensity: 0 };
  for (const cue of CUES) if (cue.pattern.test(text)) shift[cue.key] += cue.delta;

  const tags = { ...item.moodTags };
  for (const key of MOOD_KEYS) tags[key] = clamp(tags[key] + clamp(shift[key], -1, 1), 1, 5);
  // A Romance genre label is the strongest romance evidence we have.
  if (/\bromance\b/.test(genreText)) tags.romance = Math.max(tags.romance, 4.5);
  // Comedy, family and animation rarely deliver grim, heavy stories.
  if (/\bcomedy\b|\bfamily\b|animation/.test(genreText) && !/horror|crime|thriller|war/.test(genreText)) {
    tags.darkness = Math.min(tags.darkness, 2.5);
  }
  return tags;
}

/**
 * How well an item's tags fit the sliders, from 0 to 1.
 * Sliders pushed toward an end count up to 3.5x more than middle ones, and an
 * extreme slider also rewards titles that lean the same way (high romance
 * favors romance-heavy titles; low romance penalizes them). High settings pull
 * harder than low ones, and missing a requested quality costs extra.
 */
export function moodFit(tags: MoodSettings, mood: MoodSettings): number {
  let total = 0;
  let best = 0;
  for (const key of MOOD_KEYS) {
    const u = clamp(Number(mood[key]) || 3, 1, 5);
    const v = clamp(Number(tags[key]) || 3, 1, 5);
    const lean = u - 3;
    const weight = 1 + Math.abs(lean) * 1.25;
    const closeness = 1 - Math.abs(u - v) / 4;
    const direction = lean === 0 ? 0 : (lean * (v - 3)) / 4; // -1..1
    // Asking FOR something (romance 5) is a stronger signal than asking to avoid
    // it (romance 1), since plenty of titles simply lack a quality.
    const pull = lean > 0 ? 3 : 1.5;
    total += weight * closeness + pull * direction;
    best += weight + pull * (Math.abs(lean) / 2);
    // A title that lacks a quality the user explicitly asked for loses extra ground.
    if (u >= 4 && v <= 2.5) total -= weight * 0.5 * (u - 3);
  }
  return clamp(total / best, 0, 1);
}

export interface MoodScored {
  item: CatalogMediaItem;
  tags: MoodSettings;
  fit: number;
  reason: string;
}

export function scoreMood(item: CatalogMediaItem, mood: MoodSettings): MoodScored {
  const tags = refineMoodTags(item);
  const fit = moodFit(tags, mood);
  return { item, tags, fit, reason: explainMoodFit(tags, mood, fit) };
}
