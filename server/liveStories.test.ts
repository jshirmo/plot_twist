import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEvent, explicitAdaptation, emptyStoryContext, type EventSignals, type StoryContext } from './liveStories';
import { collapseRuns, getLiveEvents, type LocalEvent } from './localService';
import { readStoryContext } from './apiRouter';

const ctx = (extra: Partial<StoryContext> = {}): StoryContext => ({ ...emptyStoryContext(), ...extra });
const theatre = (name: string, details = ''): EventSignals => ({ name, details, segment: 'Arts & Theatre', genre: 'Theatre' });

// ---------- Matching and labels ----------

test('a saved podcast outranks every other kind of event', () => {
  const library = ctx({ podcasts: ['Morbid'] });
  const saved = classifyEvent({ name: 'Morbid: Live', segment: 'Arts & Theatre', genre: 'Comedy' }, library);
  const general = classifyEvent({ name: 'Some Other Podcast Live', segment: 'Arts & Theatre', genre: 'Spoken Word' }, library);
  const play = classifyEvent(theatre('Hamilton', 'based on the book by Ron Chernow'), library);
  assert.ok(saved && general && play);
  assert.equal(saved.tier, 'saved');
  assert.deepEqual(saved.badges, ['Live Podcast']);
  assert.equal(saved.matchedTitle, 'Morbid');
  assert.match(saved.reason, /podcast in your library/);
  assert.ok(saved.score > play.score && play.score > general.score, 'saved > adaptation > story');
});

test('a saved book matched on stage is a possible book adaptation', () => {
  const library = ctx({ books: [{ title: 'Pride and Prejudice: A Novel', author: 'Jane Austen' }] });
  const match = classifyEvent(theatre('Pride and Prejudice'), library);
  assert.ok(match);
  assert.equal(match.tier, 'saved');
  assert.deepEqual(match.badges, ['Book Adaptation', 'On Stage']);
  assert.equal(match.reason, 'A possible stage adaptation of Pride and Prejudice: A Novel, a book in your library.');
  assert.equal(match.kind, 'book');
});

test('a saved author appearing live is an author event', () => {
  const library = ctx({ books: [{ title: 'It Ends with Us', author: 'Colleen Hoover' }] });
  const match = classifyEvent({ name: 'An Evening with Colleen Hoover', segment: 'Arts & Theatre', genre: 'Spoken Word' }, library);
  assert.ok(match);
  assert.equal(match.tier, 'saved');
  assert.ok(match.badges.includes('Author Event'));
  assert.equal(match.matchedTitle, 'Colleen Hoover');
  assert.match(match.reason, /Colleen Hoover, an author in your library/);
});

test('saved movies and shows match screenings and stage versions', () => {
  const library = ctx({ movies: ['Harry Potter and the Sorcerer’s Stone'], shows: ['Stranger Things'] });
  const concert = classifyEvent({ name: 'Harry Potter and the Sorcerer’s Stone in Concert', segment: 'Music', genre: 'Classical' }, library);
  assert.ok(concert);
  assert.equal(concert.tier, 'saved');
  assert.ok(concert.badges.includes('Screening'));
  assert.match(concert.reason, /a movie in your library/);

  const stage = classifyEvent(theatre('Stranger Things: The First Shadow'), library);
  assert.ok(stage);
  assert.ok(stage.badges.includes('TV Experience') && stage.badges.includes('On Stage'));
});

test('adaptation labels need evidence: a title match or an explicit listing', () => {
  // No saved match and nothing saying it's adapted: plain "On Stage", no adaptation label.
  const plain = classifyEvent(theatre('Hadestown'), ctx({ books: [{ title: 'Circe' }] }));
  assert.ok(plain);
  assert.equal(plain.tier, 'story');
  assert.deepEqual(plain.badges, ['On Stage']);
  assert.doesNotMatch(plain.reason, /library|adapt/i);

  // Listing explicitly says it's based on a novel.
  const listed = classifyEvent(theatre('The Outsiders', 'A new musical based on the classic novel by S.E. Hinton.'), ctx());
  assert.ok(listed);
  assert.equal(listed.tier, 'adaptation');
  assert.ok(listed.badges.includes('Book Adaptation'));
  assert.equal(listed.reason, 'Adapted from a book, according to the event listing.');
  assert.equal(listed.matchedTitle, undefined);

  // A band that shares a saved book's name is not that book.
  const band = classifyEvent({ name: 'Dune', segment: 'Music', genre: 'Rock' }, ctx({ books: [{ title: 'Dune' }] }));
  assert.equal(band, null);

  // Generic titles never count as a match.
  const generic = classifyEvent(theatre('Love Actually Live'), ctx({ books: [{ title: 'Love' }] }));
  assert.ok(generic);
  assert.notEqual(generic.tier, 'saved');

  assert.equal(explicitAdaptation('Based on the hit film'), 'film');
  assert.equal(explicitAdaptation('Based on the beloved television series'), 'tv');
  assert.equal(explicitAdaptation('A brand-new original musical'), undefined);
});

test('a taste match is described as a taste match, never as a library connection', () => {
  const mood = { darkness: 4, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 3 };
  const match = classifyEvent({ name: 'Murder Mystery Dinner Theatre', segment: 'Arts & Theatre', genre: 'Theatre' }, ctx({ mood }));
  assert.ok(match);
  assert.equal(match.tier, 'story');
  assert.ok(match.badges.includes('Mystery Experience'));
  assert.match(match.reason, /Matches your taste for suspense and mystery\./);
  assert.doesNotMatch(match.reason, /library/);
  assert.ok(!match.badges.some((b) => /Adaptation|TV Experience/.test(b)));
});

test('parking passes and unrelated listings are dropped; comedy needs permission', () => {
  assert.equal(classifyEvent(theatre('Hamilton - Parking Pass'), ctx()), null);
  assert.equal(classifyEvent({ name: 'Lakers vs Celtics', segment: 'Sports', genre: 'Basketball' }, ctx()), null);
  const comedy = { name: 'Stand-up Night', segment: 'Arts & Theatre', genre: 'Comedy' };
  assert.equal(classifyEvent(comedy, ctx()), null);
  const allowed = classifyEvent(comedy, ctx(), { allowComedy: true });
  assert.ok(allowed);
  assert.equal(allowed.tier, 'comedy');
  assert.deepEqual(allowed.badges, ['Comedy']);
});

// ---------- Deduplication ----------

test('repeat nights and touring listings collapse into one card', () => {
  const ev = (id: string, name: string, date: string): LocalEvent => ({ id, name, url: 'u', date, kind: 'stage' });
  const out = collapseRuns([
    ev('1', 'Hamilton (Touring)', '2027-01-10'),
    ev('2', 'HAMILTON', '2027-01-11'),
    ev('3', 'Hamilton', '2027-01-12'),
    ev('4', 'Wicked', '2027-01-12'),
  ]);
  assert.deepEqual(out.map((e) => [e.id, e.moreDates ?? 0]), [['1', 2], ['4', 0]]);
});

// ---------- The full search ----------

type FakeEvent = { id: string; name: string; segment?: string; genre?: string; info?: string; date?: string };

function fakeTicketmaster(byQuery: (keyword: string, classification: string) => FakeEvent[]) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string) => {
    const url = new URL(String(input));
    const keyword = url.searchParams.get('keyword') || '';
    const classification = url.searchParams.get('classificationName') || '';
    calls.push(`${keyword}|${classification}`);
    const events = byQuery(keyword, classification).map((e) => ({
      id: e.id,
      name: e.name,
      url: `https://ticketmaster.com/${e.id}`,
      info: e.info,
      dates: { start: { localDate: e.date || '2027-02-01' } },
      classifications: [{ primary: true, segment: { name: e.segment || 'Arts & Theatre' }, genre: { name: e.genre || 'Theatre' } }],
    }));
    return new Response(JSON.stringify(events.length ? { _embedded: { events } } : {}), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

async function withTicketmaster<T>(fetchImpl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  process.env.TICKETMASTER_API_KEY = 'test-key';
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.TICKETMASTER_API_KEY;
  }
}

test('saved titles rank first, results are deduplicated, and comedy is skipped when stories exist', async () => {
  const { calls, fetchImpl } = fakeTicketmaster((keyword, classification) => {
    if (keyword === 'podcast') return [{ id: 'p1', name: 'Crime Junkie Live', genre: 'Spoken Word' }, { id: 'p2', name: 'Other Podcast Live', genre: 'Spoken Word' }];
    if (keyword === 'Crime Junkie') return [{ id: 'p1', name: 'Crime Junkie Live', genre: 'Spoken Word' }];
    if (classification === 'Theatre') {
      return [
        { id: 't1', name: 'Wicked', date: '2027-03-01' },
        { id: 't2', name: 'Wicked', date: '2027-03-02' },
        { id: 't3', name: 'Hadestown' },
        { id: 't4', name: 'The Great Gatsby' },
        { id: 't5', name: 'Les Misérables', info: 'Based on the novel by Victor Hugo.' },
      ];
    }
    if (classification === 'Film') return [{ id: 'f1', name: 'Jaws 50th Anniversary Screening', segment: 'Film', genre: 'Miscellaneous' }];
    if (keyword === 'murder mystery') return [{ id: 'm1', name: 'Murder Mystery Dinner', genre: 'Theatre' }];
    if (classification === 'Comedy') return [{ id: 'c1', name: 'Stand-up Night', genre: 'Comedy' }];
    return [];
  });
  const result = await withTicketmaster(fetchImpl, () => getLiveEvents(
    { city: 'Testville' },
    { podcasts: ['Crime Junkie'], books: [{ title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' }] },
    { pauseMs: 0, today: new Date('2027-01-15T12:00:00') },
  ));

  const ids = result.events.map((e) => e.id);
  assert.deepEqual(ids.slice(0, 2).sort(), ['p1', 't4'], 'saved podcast and saved book come first');
  assert.equal(ids[2], 't5', 'explicit adaptation comes next');
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  assert.equal(result.events.filter((e) => e.name === 'Wicked').length, 1);
  assert.equal(result.events.find((e) => e.name === 'Wicked')?.moreDates, 1);
  assert.equal(result.fallback, false);
  assert.equal(result.comedyIncluded, false);
  assert.ok(!calls.some((c) => c.endsWith('|Comedy')), 'comedy is never searched when story events exist');
  assert.ok(calls.some((c) => c === 'Crime Junkie|'), 'saved titles get their own search');
});

test('comedy is only a last resort and always ranks below story events', async () => {
  const { calls, fetchImpl } = fakeTicketmaster((keyword, classification) => {
    if (classification === 'Theatre') return [{ id: 't1', name: 'Hadestown' }];
    if (classification === 'Comedy') return [{ id: 'c1', name: 'Stand-up Night', genre: 'Comedy' }, { id: 'c2', name: 'Improv Jam', genre: 'Comedy' }];
    return [];
  });
  const result = await withTicketmaster(fetchImpl, () => getLiveEvents({ city: 'Smallville' }, {}, { pauseMs: 0 }));
  assert.ok(calls.some((c) => c.endsWith('|Comedy')));
  assert.deepEqual(result.events.map((e) => e.id), ['t1', 'c1', 'c2']);
  assert.ok(result.events.slice(1).every((e) => e.tier === 'comedy' && e.badges?.includes('Comedy')));
  assert.equal(result.fallback, true, 'no direct story matches, so the honest fallback message shows');
  assert.equal(result.comedyIncluded, true);
});

// ---------- Request validation ----------

test('story context from the browser is capped and cleaned', () => {
  const context = readStoryContext({
    podcasts: ['Serial', 'Serial', 42, '', 'x'.repeat(500)],
    books: [{ title: 'Circe', author: 'Madeline Miller' }, { title: '' }, 'nope'],
    movies: Array.from({ length: 40 }, (_, i) => `Movie ${i}`),
    mood: { darkness: 9, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 3 },
  });
  assert.deepEqual(context.podcasts, ['Serial', 'x'.repeat(120)]);
  assert.deepEqual(context.books, [{ title: 'Circe', author: 'Madeline Miller' }]);
  assert.equal(context.movies.length, 15);
  assert.deepEqual(context.shows, []);
  assert.equal(context.mood?.darkness, 5);
});

// ---------- Regressions from real New York listings (Nov 17) ----------

test('"in concert" only counts as a screening when it points at a film or an orchestra', () => {
  const singers = classifyEvent({ name: 'Il Volo LIVE IN CONCERT', segment: 'Music', genre: 'Classical' }, ctx());
  assert.equal(singers, null, 'a vocal group on tour is not a movie screening');

  const potter = classifyEvent({ name: 'New York Philharmonic w/ Harry Potter and the Sorcerers Stone in Concert', segment: 'Music', genre: 'Classical' }, ctx());
  assert.ok(potter?.badges.includes('Screening'));
  const wicked = classifyEvent({ name: 'Wicked: Part One in Concert', segment: 'Music', genre: 'Classical' }, ctx());
  assert.ok(wicked?.badges.includes('Screening'));

  // A saved movie's title plus "in Concert" is that movie with an orchestra...
  const saved = classifyEvent({ name: 'Harry Potter and the Sorcerer’s Stone in Concert', segment: 'Music', genre: 'Pop' },
    ctx({ movies: ['Harry Potter and the Sorcerer’s Stone'] }));
  assert.equal(saved?.tier, 'saved');
  // ...but a band that happens to share a saved podcast's name is not that podcast.
  assert.equal(classifyEvent({ name: 'Serial in Concert', segment: 'Music', genre: 'Pop' }, ctx({ podcasts: ['Serial'] })), null);
});

test('loose "immersive" or "experience" wording in a description does not make an event Immersive', () => {
  const comedy = classifyEvent({
    name: 'A Very Good+ Night of Comedy Featuring Jerry Seinfeld + Friends',
    details: 'An immersive night of laughs. The ultimate comedy experience.',
    segment: 'Arts & Theatre',
    genre: 'Comedy',
  }, ctx());
  assert.equal(comedy, null, 'comedy is still only a last resort');

  const rockettes = classifyEvent(theatre('Christmas Spectacular Starring The Radio City Rockettes', 'An immersive holiday experience.'), ctx());
  assert.ok(rockettes);
  assert.deepEqual(rockettes.badges, ['On Stage']);

  const museum = classifyEvent({ name: 'The Banksy Museum New York!', details: 'An immersive exhibition.', segment: 'Miscellaneous', genre: 'Miscellaneous' }, ctx());
  assert.ok(museum?.badges.includes('Immersive'), 'attractions can still be immersive from their description');
});

test('tonight’s shows keep their “coming up soon” boost after 6 PM Central', () => {
  const tonight = classifyEvent({ ...theatre('Hadestown'), daysAway: -1 }, ctx());
  const nextMonth = classifyEvent({ ...theatre('Hadestown'), daysAway: 45 }, ctx());
  assert.ok(tonight && nextMonth && tonight.score > nextMonth.score);
});
