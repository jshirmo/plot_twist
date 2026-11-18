// "Stories Come Alive Near You": decides what kind of live event a Ticketmaster listing is,
// whether it connects to something in the user's library, and how to explain that honestly.
// Pure functions only (no network), so the rules are easy to test. Owner: Chloe.
//
// Accuracy rules:
// - "Book Adaptation", "Film Adaptation" and "TV Experience" are only used when an event's
//   name directly matches a saved title, or its listing explicitly says it is adapted from a
//   book, film or TV show.
// - A genre or mood match is described as just that ("Matches your taste for suspense and
//   mystery"), never as a connection to a saved title.

import type { MoodSettings } from '../src/types';

export type LiveKind = 'podcast' | 'book' | 'screen' | 'stage' | 'immersive' | 'comedy' | 'other';

export type EventBadge =
  | 'Live Podcast'
  | 'Book Adaptation'
  | 'Film Adaptation'
  | 'TV Experience'
  | 'On Stage'
  | 'Author Event'
  | 'Live Reading'
  | 'Screening'
  | 'Immersive'
  | 'Mystery Experience'
  | 'Comedy';

/** Ranking tiers, best first. */
export type MatchTier = 'saved' | 'adaptation' | 'story' | 'taste' | 'comedy';

export interface SavedBook {
  title: string;
  author?: string;
}

/** What the user loves, sent by the Near You page. Every list is optional. */
export interface StoryContext {
  podcasts: string[];
  books: SavedBook[];
  movies: string[];
  shows: string[];
  genres: string[];
  mood?: MoodSettings;
}

export const emptyStoryContext = (): StoryContext => ({ podcasts: [], books: [], movies: [], shows: [], genres: [] });

/** The parts of a Ticketmaster listing the rules look at. */
export interface EventSignals {
  name: string;
  /** Extra listing text (info, notes, description). */
  details?: string;
  segment?: string;
  genre?: string;
  subGenre?: string;
  /** Found by the general "podcast" keyword search. */
  fromPodcastSearch?: boolean;
  /** Days until the event, when known. */
  daysAway?: number;
}

export interface StoryMatch {
  kind: LiveKind;
  badges: EventBadge[];
  tier: MatchTier;
  reason: string;
  score: number;
  matchedTitle?: string;
  /** Kept for older clients: set when a saved podcast matched. */
  matchedPodcast?: string;
}

type Category = 'podcast' | 'screening' | 'stage' | 'author' | 'reading' | 'immersive' | 'mystery' | 'comedy';

// ---------- Text helpers ----------

export function normalizeText(value = ''): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "The Seven Husbands of Evelyn Hugo: A Novel" -> "the seven husbands of evelyn hugo" */
export function mainTitle(title: string): string {
  return normalizeText(title.split(/[:([\]]| - | – | — /)[0]);
}

// Titles too generic to match on their own ("Love", "Home"...).
const GENERIC_TITLES = new Set([
  'love', 'home', 'live', 'life', 'music', 'family', 'friends', 'together', 'the end', 'tonight', 'show',
  'podcast', 'the show', 'untitled', 'hello', 'us', 'it', 'up', 'her', 'him', 'them', 'you', 'me', 'run',
  'play', 'the play', 'movie', 'the movie', 'book', 'the book', 'night', 'the night', 'christmas', 'holiday',
]);

function usableTitle(title: string): string | undefined {
  const t = mainTitle(title);
  if (t.length < 4 || GENERIC_TITLES.has(t) || GENERIC_TITLES.has(t.replace(/^the /, ''))) return undefined;
  return t;
}

const hasPhrase = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);

function joinWords(words: string[]) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// ---------- What kind of event is this? ----------

const JUNK = /\b(parking|gift card|voucher|upgrade|add ?on|shuttle|locker|tailgate|souvenir)\b/;
const PACKAGE = /\b(vip|package|hospitality|meet and greet|upsell)\b/;

export function categorize(sig: EventSignals): Set<Category> {
  const name = normalizeText(sig.name);
  const text = normalizeText(`${sig.name} ${sig.details || ''}`);
  const segment = normalizeText(sig.segment);
  const genre = normalizeText(`${sig.genre || ''} ${sig.subGenre || ''}`);
  const cats = new Set<Category>();

  if (/\bpodcast\b/.test(text) || sig.fromPodcastSearch) cats.add('podcast');

  // A movie shown with a live orchestra. "In concert" alone isn't enough: singers tour "in concert"
  // too, so the listing's name has to point at a film or an orchestra.
  const liveScore = /\b(live to film|live score|film with live orchestra|movie in concert|film in concert)\b/.test(name)
    || (/\bin concert\b/.test(name)
      && (segment === 'film' || /\b(film|movie|orchestra|symphony|philharmonic|pops|part one|part two|part 1|part 2)\b/.test(name)));
  if (segment === 'film' || liveScore
    || /\b(screening|screenings|cinema|film festival|35 ?mm|70 ?mm|double feature|sing ?a ?long|quote ?a ?long|premiere)\b/.test(name)) {
    cats.add('screening');
  }

  if (!cats.has('podcast') && (/\b(theatre|theater|musical|musicals|opera|broadway|play|drama|children s theatre|puppetry)\b/.test(genre)
    || /\b(the musical|a new play|on broadway|the opera)\b/.test(name))) {
    cats.add('stage');
  }

  if (/\b(author|authors|book launch|book signing|book talk|book tour|book festival|book fest|literary|in conversation|poetry|poet|novelist)\b/.test(text)) {
    cats.add('author');
  }
  if (/\b(reading|readings|storytelling|story ?slam|the moth|live lit)\b/.test(name)) cats.add('reading');

  // Ticket descriptions use words like "immersive" and "experience" loosely (comedy nights,
  // concerts, holiday shows), so the description only counts for exhibitions and attractions.
  const experienceSegment = /arts and theatre|miscellaneous|film/.test(segment);
  const attraction = segment === 'miscellaneous' && !/comedy/.test(genre) && !cats.has('podcast');
  const immersiveWords = /\b(immersive|escape room)\b|\binteractive (theatre|theater|experience|show|adventure)\b/;
  if ((immersiveWords.test(name) || (attraction && immersiveWords.test(text))
    || (experienceSegment && /\b(experience|exhibition)\b/.test(name))) && !PACKAGE.test(name)) {
    cats.add('immersive');
  }

  const mysteryWords = /\b(murder mystery|mystery dinner|whodunit|whodunnit|detective|sherlock|murder on the|agatha christie|escape room)\b/;
  if (mysteryWords.test(name) || /\bclue\b/.test(name)
    || (mysteryWords.test(text) && /theatre|theater|miscellaneous/.test(`${segment} ${genre}`) && !/comedy/.test(genre))) {
    cats.add('mystery');
  }

  if (/comedy/.test(genre) && !cats.has('podcast') && !cats.has('stage')) cats.add('comedy');
  // Ticketmaster files talks, readings and podcasts under "Spoken Word"; only call it a
  // reading when nothing more specific applies.
  if (/spoken word/.test(genre) && cats.size === 0) cats.add('reading');
  return cats;
}

/** Listing text that explicitly says the event is adapted from a book, film or TV show. */
export function explicitAdaptation(text: string): 'book' | 'film' | 'tv' | undefined {
  const t = normalizeText(text);
  const adj = '(?:(?:best ?selling|classic|award winning|beloved|hit|iconic|acclaimed|celebrated|original|famous) )*';
  if (new RegExp(`\\b(based on|adapted from|adaptation of|from) the ${adj}(novel|book|memoir|children s book|story by)\\b`).test(t)) return 'book';
  if (new RegExp(`\\b(based on|adapted from|adaptation of) the ${adj}(film|movie|motion picture)\\b`).test(t)
    || /\bthe musical based on the (?:\w+ )?(film|movie)\b/.test(t)) return 'film';
  if (new RegExp(`\\b(based on|adapted from|adaptation of) the ${adj}(tv|television) (series|show)\\b`).test(t)) return 'tv';
  return undefined;
}

// ---------- Does it connect to the user's library? ----------

type SavedHit = { type: 'podcast' | 'book' | 'author' | 'movie' | 'show'; title: string };

export function matchSaved(sig: EventSignals, ctx: StoryContext, cats: Set<Category>): SavedHit | undefined {
  const name = normalizeText(sig.name);
  const text = normalizeText(`${sig.name} ${sig.details || ''}`);
  const segment = normalizeText(sig.segment);
  // A band called "Dune" or a team called "Gone Girl FC" is not your book.
  const storySegment = cats.size > 0 || /arts and theatre|film|miscellaneous/.test(segment) || /\bin concert\b/.test(name);
  if (!storySegment || segment === 'sports') return undefined;

  for (const title of ctx.podcasts) {
    const t = usableTitle(title);
    if (t && hasPhrase(name, t) && (!/music/.test(segment) || cats.has('podcast'))) return { type: 'podcast', title };
  }
  for (const book of ctx.books) {
    const author = normalizeText(book.author);
    // A full name (two words or more) appearing in the listing.
    if (author.split(' ').length >= 2 && hasPhrase(text, author) && !/music/.test(segment)) {
      return { type: 'author', title: book.author as string };
    }
  }
  for (const book of ctx.books) {
    const t = usableTitle(book.title);
    if (t && hasPhrase(name, t) && !/music/.test(segment)) return { type: 'book', title: book.title };
  }
  for (const movie of ctx.movies) {
    const t = usableTitle(movie);
    // "<a saved movie> in Concert" is that movie with a live orchestra, even when it's filed under Music.
    if (t && hasPhrase(name, t) && (!/music/.test(segment) || cats.has('screening') || /\bin concert\b/.test(name))) {
      return { type: 'movie', title: movie };
    }
  }
  for (const show of ctx.shows) {
    const t = usableTitle(show);
    if (t && hasPhrase(name, t) && !/music/.test(segment)) return { type: 'show', title: show };
  }
  return undefined;
}

// ---------- Does it fit the user's taste? ----------

export function tasteMatch(sig: EventSignals, cats: Set<Category>, ctx: StoryContext): { score: number; aspects: string[] } {
  const t = normalizeText(`${sig.name} ${sig.details || ''} ${sig.genre || ''} ${sig.subGenre || ''}`);
  const aspects: string[] = [];
  const m = ctx.mood;
  if (m) {
    if ((m.suspense >= 4 || m.plotTwists >= 4)
      && (cats.has('mystery') || /\b(mystery|murder|detective|thriller|crime|suspense|whodunit|psychological)\b/.test(t))) {
      aspects.push('suspense and mystery');
    }
    if (m.darkness >= 4 && /\b(horror|ghost|ghosts|haunt|haunted|dark|gothic|macabre|phantom|dracula|frankenstein|vampire|witch|nightmare|terror)\b/.test(t)) {
      aspects.push('darker stories');
    }
    if (m.romance >= 4 && /\b(romance|romantic|love story|romeo|juliet|pride and prejudice|bridgerton|wedding)\b/.test(t)) {
      aspects.push('romance');
    }
    if (m.darkness <= 2 && /\b(family|disney|kids|children|feel good|musical|holiday|christmas|sing ?a ?long)\b/.test(t)) {
      aspects.push('lighter, feel-good stories');
    }
    if (m.emotionalIntensity >= 4 && /\b(drama|opera|tragedy|les miserables|requiem)\b/.test(t)) {
      aspects.push('big emotional stories');
    }
  }
  for (const genre of ctx.genres) {
    const g = normalizeText(genre);
    if (g.length >= 4 && hasPhrase(t, g) && !aspects.some((a) => a.includes(g))) {
      aspects.push(genre.toLowerCase());
      break;
    }
  }
  return { score: Math.min(1, aspects.length * 0.4), aspects };
}

// ---------- Putting it together ----------

const TIER_BASE: Record<MatchTier, number> = { saved: 1000, adaptation: 800, story: 500, taste: 300, comedy: 100 };

const CATEGORY_BADGE: Record<Category, EventBadge> = {
  podcast: 'Live Podcast',
  screening: 'Screening',
  stage: 'On Stage',
  author: 'Author Event',
  reading: 'Live Reading',
  immersive: 'Immersive',
  mystery: 'Mystery Experience',
  comedy: 'Comedy',
};

const STORY_REASON: Record<Exclude<Category, 'comedy'>, string> = {
  podcast: 'A live podcast show near you.',
  author: 'A live author event near you.',
  reading: 'A live reading or storytelling night near you.',
  screening: 'A special film screening near you.',
  stage: 'Live theatre near you.',
  mystery: 'A live mystery where you get to play detective.',
  immersive: 'An immersive story experience near you.',
};
const STORY_ORDER: Array<Exclude<Category, 'comedy'>> = ['podcast', 'author', 'reading', 'screening', 'mystery', 'stage', 'immersive'];

function kindFor(badges: EventBadge[]): LiveKind {
  if (badges.includes('Live Podcast')) return 'podcast';
  if (badges.some((b) => b === 'Book Adaptation' || b === 'Author Event' || b === 'Live Reading')) return 'book';
  if (badges.some((b) => b === 'Screening' || b === 'Film Adaptation' || b === 'TV Experience')) return 'screen';
  if (badges.includes('On Stage')) return 'stage';
  if (badges.some((b) => b === 'Immersive' || b === 'Mystery Experience')) return 'immersive';
  if (badges.includes('Comedy')) return 'comedy';
  return 'other';
}

/**
 * Classify one event. Returns null for events that don't belong in Live Plot Twist
 * (parking passes, unrelated concerts and sports), or for comedy unless `allowComedy`.
 */
export function classifyEvent(sig: EventSignals, ctx: StoryContext, opts: { allowComedy?: boolean } = {}): StoryMatch | null {
  const name = normalizeText(sig.name);
  if (JUNK.test(name)) return null;

  const cats = categorize(sig);
  const saved = matchSaved(sig, ctx, cats);
  const adaptation = explicitAdaptation(`${sig.name} ${sig.details || ''}`);
  const taste = tasteMatch(sig, cats, ctx);
  const tasteLine = taste.aspects.length ? `Matches your taste for ${joinWords(taste.aspects.slice(0, 2))}.` : '';
  // -1 allows for the server's clock (UTC) already being on tomorrow during a US evening.
  const soon = sig.daysAway !== undefined && sig.daysAway >= -1 && sig.daysAway <= 30 ? 10 : 0;

  const badges: EventBadge[] = [];
  const add = (b: EventBadge) => { if (!badges.includes(b)) badges.push(b); };
  let tier: MatchTier;
  let reason: string;
  let matchedTitle: string | undefined;
  let matchedPodcast: string | undefined;

  if (saved) {
    tier = 'saved';
    matchedTitle = saved.title;
    const artsSegment = /arts and theatre/.test(normalizeText(sig.segment));
    const where = cats.has('screening') ? 'screen'
      : cats.has('stage') || (artsSegment && !cats.has('immersive') && !cats.has('podcast')) ? 'stage'
      : cats.has('immersive') ? 'immersive' : 'other';
    switch (saved.type) {
      case 'podcast':
        add('Live Podcast');
        matchedPodcast = saved.title;
        reason = `A live show from ${saved.title}, a podcast in your library.`;
        break;
      case 'author':
        add('Author Event');
        if (cats.has('reading')) add('Live Reading');
        reason = `${saved.title}, an author in your library, appears at this event.`;
        break;
      case 'book':
        add('Book Adaptation');
        if (where === 'stage') { add('On Stage'); reason = `A possible stage adaptation of ${saved.title}, a book in your library.`; }
        else if (where === 'screen') { add('Screening'); reason = `A screening that may be adapted from ${saved.title}, a book in your library.`; }
        else if (cats.has('author') || cats.has('reading')) {
          badges.length = 0; add(cats.has('reading') ? 'Live Reading' : 'Author Event');
          reason = `An event about ${saved.title}, a book in your library.`;
        } else {
          if (where === 'immersive') add('Immersive');
          reason = `A live experience that shares its title with ${saved.title}, a book in your library.`;
        }
        break;
      case 'movie':
        if (where === 'stage') { add('Film Adaptation'); add('On Stage'); reason = `A possible stage version of ${saved.title}, a movie in your library.`; }
        else if (where === 'immersive') { add('Film Adaptation'); add('Immersive'); reason = `An immersive experience that shares its title with ${saved.title}, a movie in your library.`; }
        else {
          add('Screening');
          reason = /\b(in concert|live to film|live score)\b/.test(name)
            ? `${saved.title} on screen with a live orchestra. It’s a movie in your library.`
            : `A screening of ${saved.title}, a movie in your library.`;
        }
        break;
      case 'show':
        add('TV Experience');
        if (where === 'stage') add('On Stage');
        if (where === 'immersive') add('Immersive');
        reason = `A live experience that shares its title with ${saved.title}, a show in your library.`;
        break;
    }
  } else if (adaptation && (cats.has('stage') || cats.has('screening') || cats.has('immersive') || /arts and theatre|film/.test(normalizeText(sig.segment)))) {
    tier = 'adaptation';
    const what = { book: 'a book', film: 'a film', tv: 'a TV show' }[adaptation];
    add(adaptation === 'book' ? 'Book Adaptation' : adaptation === 'film' ? 'Film Adaptation' : 'TV Experience');
    if (cats.has('screening')) add('Screening');
    else if (cats.has('immersive')) add('Immersive');
    else add('On Stage');
    reason = `Adapted from ${what}, according to the event listing.`;
  } else {
    const primary = STORY_ORDER.find((c) => cats.has(c));
    if (primary) {
      tier = 'story';
      reason = STORY_REASON[primary];
    } else if (cats.has('comedy')) {
      if (!opts.allowComedy) return null;
      tier = 'comedy';
      reason = 'A comedy show nearby. It isn’t tied to a story, but it’s a fun night out.';
    } else if (taste.aspects.length && /arts and theatre|film|miscellaneous/.test(normalizeText(sig.segment))) {
      tier = 'taste';
      reason = tasteLine;
    } else {
      return null;
    }
  }

  for (const c of STORY_ORDER) if (cats.has(c)) add(CATEGORY_BADGE[c]);
  if (tier === 'comedy') add('Comedy');
  if (tier === 'taste' && /arts and theatre/.test(normalizeText(sig.segment))) add('On Stage');
  // A show that isn't actually a podcast shouldn't wear both podcast and stage badges.
  if (badges.includes('Live Podcast')) {
    const i = badges.indexOf('On Stage');
    if (i >= 0) badges.splice(i, 1);
  }

  if (tasteLine && tier !== 'taste') reason = `${reason} ${tasteLine}`;
  return {
    kind: kindFor(badges),
    badges,
    tier,
    reason,
    score: TIER_BASE[tier] + taste.score * 80 + soon,
    matchedTitle,
    matchedPodcast,
  };
}

/** Key used to merge listings of the same show ("Hamilton (Touring)" and "HAMILTON"). */
export function showKey(name: string): string {
  return normalizeText(name.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '));
}
