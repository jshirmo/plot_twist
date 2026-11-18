// Shared, dependency-free mood helpers used by both the Discover page and the
// server ranking code, so the "discovery signal" the user reads and the reason
// shown on each card always use the same wording.
import type { MoodSettings } from '../types';

export type MoodKey = keyof MoodSettings;

export const MOOD_KEYS: MoodKey[] = ['darkness', 'romance', 'suspense', 'plotTwists', 'emotionalIntensity'];

const LEVEL_TEXT: Record<MoodKey, [string, string, string, string, string]> = {
  darkness: ['Light and uplifting', 'Leaning light', 'Any tone', 'Leaning dark', 'Dark and gritty'],
  romance: ['No romance', 'Go easy on romance', 'Romance optional', 'Romance welcome', 'Romance at the center'],
  suspense: ['Calm and relaxed', 'Mostly relaxed', 'Some tension', 'Plenty of tension', 'Edge-of-your-seat suspense'],
  plotTwists: ['Straightforward story', 'Mostly straightforward', 'Twists optional', 'A few good surprises', 'Mind-bending twists'],
  emotionalIntensity: ['Comforting and easy', 'Easygoing', 'Medium intensity', 'Emotionally rich', 'Emotionally powerful'],
};

// How a matched selection reads in a card's reason.
const HIGH_LABEL: Record<MoodKey, string> = {
  darkness: 'darkness',
  romance: 'romance',
  suspense: 'suspense',
  plotTwists: 'plot twists',
  emotionalIntensity: 'emotional intensity',
};
const LOW_LABEL: Record<MoodKey, string> = {
  darkness: 'a lighter tone',
  romance: 'little romance',
  suspense: 'a relaxed pace',
  plotTwists: 'a straightforward story',
  emotionalIntensity: 'easy, comforting energy',
};

const clampLevel = (value: number) => Math.max(1, Math.min(5, Math.round(Number(value) || 3)));

export function moodLevelText(key: MoodKey, value: number): string {
  return LEVEL_TEXT[key][clampLevel(value) - 1];
}

/** Slider choices away from the neutral middle, strongest first. */
export function strongestSelections(mood: MoodSettings) {
  return MOOD_KEYS
    .map((key) => ({ key, value: clampLevel(mood[key]), strength: Math.abs(clampLevel(mood[key]) - 3) }))
    .filter((entry) => entry.strength > 0)
    .sort((a, b) => b.strength - a.strength || MOOD_KEYS.indexOf(a.key) - MOOD_KEYS.indexOf(b.key));
}

function joinWords(words: string[]) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export interface DiscoverySignal {
  headline: string;
  favoring: string[];
  avoiding: string[];
  lines: Array<{ key: MoodKey; label: string; value: number; text: string; strength: number }>;
}

/** Plain-language summary of what the current sliders will do to results. */
export function describeDiscoverySignal(mood: MoodSettings): DiscoverySignal {
  const level = (key: MoodKey) => clampLevel(mood[key]);
  const favoring: string[] = [];
  const avoiding: string[] = [];

  if (level('suspense') >= 4 || level('plotTwists') >= 4) favoring.push('thrillers, mysteries, crime and psychological stories');
  if (level('romance') >= 4) favoring.push('romance-driven stories');
  if (level('darkness') >= 4) favoring.push('darker, grittier picks');
  if (level('darkness') <= 2) favoring.push('lighter, uplifting picks');
  if (level('emotionalIntensity') >= 4) favoring.push('emotionally powerful stories');
  if (level('emotionalIntensity') <= 2) favoring.push('easy, low-stress picks');

  if (level('romance') <= 2) avoiding.push('romance-heavy stories');
  if (level('darkness') <= 2) avoiding.push('grim or violent stories');
  if (level('suspense') <= 2 && level('plotTwists') <= 2) avoiding.push('twisty, high-tension thrillers');
  if (level('emotionalIntensity') <= 2) avoiding.push('heavy tearjerkers');

  const strongest = strongestSelections(mood).slice(0, 3).map(({ key, value }) => moodLevelText(key, value).toLowerCase());
  const headline = strongest.length
    ? `You asked for ${joinWords(strongest)}.`
    : 'All sliders are in the middle, so results are balanced across moods.';

  const label: Record<MoodKey, string> = {
    darkness: 'Darkness', romance: 'Romance', suspense: 'Suspense', plotTwists: 'Plot twists', emotionalIntensity: 'Emotional intensity',
  };
  const lines = MOOD_KEYS.map((key) => ({
    key, label: label[key], value: level(key), text: moodLevelText(key, level(key)), strength: Math.abs(level(key) - 3),
  }));
  return { headline, favoring, avoiding, lines };
}

/**
 * One-line reason naming the user's strongest selections this title actually
 * satisfies, e.g. "Strong match for suspense and plot twists".
 */
export function explainMoodFit(tags: MoodSettings, mood: MoodSettings, fit: number): string {
  const selections = strongestSelections(mood);
  if (!selections.length) return 'Balanced pick for your middle-of-the-road mood';

  const highs: string[] = [];
  const lows: string[] = [];
  for (const { key, value } of selections) {
    const v = tags[key];
    if (value >= 4 && v >= 3.5) highs.push(HIGH_LABEL[key]);
    if (value <= 2 && v <= 2.5) lows.push(LOW_LABEL[key]);
  }
  const strength = fit >= 0.8 ? 'Strong match' : fit >= 0.6 ? 'Good match' : 'Partial match';
  const topHighs = highs.slice(0, 2);
  const topLows = lows.slice(0, highs.length ? 1 : 2);
  if (topHighs.length && topLows.length) return `${strength} for ${joinWords(topHighs)}, with ${joinWords(topLows)}`;
  if (topHighs.length) return `${strength} for ${joinWords(topHighs)}`;
  if (topLows.length) return `${strength}: ${joinWords(topLows)}, as you asked`;
  const top = selections[0];
  return `Closest available pick for ${moodLevelText(top.key, top.value).toLowerCase()}`;
}
