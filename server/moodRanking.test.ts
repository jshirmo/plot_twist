import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRecommendationPage, rankCandidatesLocally } from './geminiService';
import { VERIFIED_CATALOG, moodCatalogHints, type CatalogMediaItem } from './mediaCatalog';
import { moodFit, refineMoodTags } from './moodRanking';
import { estimateMoodTags } from './podcastService';
import { describeDiscoverySignal, explainMoodFit } from '../src/lib/moodSignal';
import type { MoodSettings } from '../src/types';

const byId = (id: string) => {
  const item = VERIFIED_CATALOG.find((entry) => entry.id === id);
  assert.ok(item, `missing catalog item ${id}`);
  return item;
};
const romanceTitles = ['movie_portrait_lady', 'book_seven_husbands'].map(byId);
const twistTitles = ['movie_shutter_island', 'movie_gone_girl', 'book_silent_patient'].map(byId);
const mixed = [...twistTitles, ...romanceTitles];

const romanceMood: MoodSettings = { darkness: 3, romance: 5, suspense: 1, plotTwists: 1, emotionalIntensity: 3 };
const twistMood: MoodSettings = { darkness: 3, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 3 };

function positions(results: Array<{ id: string }>, items: CatalogMediaItem[]) {
  return items.map((item) => results.findIndex((result) => result.id === item.id));
}

// A synthetic live-style catalog: tags estimated from genres, like TMDB/Books items.
function liveItem(id: string, genres: string[], overview = '', mediaType: CatalogMediaItem['mediaType'] = 'movie'): CatalogMediaItem {
  return {
    id, catalogId: id, source: 'tmdb', mediaType, title: `Title ${id}`, creator: 'Someone', releaseYear: '2020',
    posterUrl: '', genres, overview, catalogOrigin: 'live', moodTags: estimateMoodTags(genres),
  };
}

function withoutGemini(t: test.TestContext) {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => { if (previous !== undefined) process.env.GEMINI_API_KEY = previous; });
}

test('extreme romance settings rank romance-oriented titles above twist-focused titles', () => {
  const results = rankCandidatesLocally(mixed, romanceMood, undefined, undefined, mixed.length);
  const romance = positions(results, romanceTitles);
  const twists = positions(results, twistTitles);
  assert.ok(Math.max(...romance) < Math.min(...twists), `romance ${romance} should all rank above twists ${twists}`);
  assert.ok(results[0].compatibilityScore - results[results.length - 1].compatibilityScore >= 15,
    'extreme sliders should create a large score gap');
});

test('extreme suspense and plot-twist settings rank twist-focused titles above romance titles', () => {
  const results = rankCandidatesLocally(mixed, twistMood, undefined, undefined, mixed.length);
  const romance = positions(results, romanceTitles);
  const twists = positions(results, twistTitles);
  assert.ok(Math.max(...twists) < Math.min(...romance), `twists ${twists} should all rank above romance ${romance}`);
  assert.match(results[0].moodMatch ?? '', /suspense and plot twists/);
});

test('the same holds for live catalog items whose moods are estimated from genres', () => {
  const live = [
    liveItem('love', ['Romance', 'Drama'], 'Two strangers fall in love over one summer.'),
    liveItem('rom-com', ['Romance', 'Comedy'], 'A wedding planner meets her match.'),
    liveItem('thriller', ['Thriller', 'Mystery'], 'A detective unravels a conspiracy with a shocking twist.'),
    liveItem('crime', ['Crime', 'Thriller'], 'A missing person case hides a dark secret.'),
  ];
  const romanceFirst = rankCandidatesLocally(live, romanceMood, undefined, undefined, 4).map((r) => r.id);
  const twistFirst = rankCandidatesLocally(live, twistMood, undefined, undefined, 4).map((r) => r.id);
  assert.deepEqual(new Set(romanceFirst.slice(0, 2)), new Set(['love', 'rom-com']));
  assert.deepEqual(new Set(twistFirst.slice(0, 2)), new Set(['thriller', 'crime']));
});

test('low darkness favors lighter titles and high darkness favors darker ones', () => {
  const light = refineMoodTags(liveItem('family', ['Family', 'Animation', 'Comedy'], 'A heartwarming adventure.'));
  const dark = refineMoodTags(liveItem('noir', ['Crime', 'Horror'], 'A brutal killer stalks the city.'));
  const lightMood = { darkness: 1, romance: 3, suspense: 3, plotTwists: 3, emotionalIntensity: 3 };
  const darkMood = { ...lightMood, darkness: 5 };
  assert.ok(moodFit(light, lightMood) > moodFit(dark, lightMood));
  assert.ok(moodFit(dark, darkMood) > moodFit(light, darkMood));
});

test('a search returns 12 unique results', async (t) => {
  withoutGemini(t);
  const catalog = Array.from({ length: 40 }, (_, i) =>
    liveItem(`item-${i}`, i % 2 ? ['Thriller'] : ['Romance'], '', (['movie', 'tv', 'book', 'podcast'] as const)[i % 4]));
  const page = await generateRecommendationPage({ moodSettings: twistMood, catalogLoader: async () => catalog });
  assert.equal(page.results.length, 12);
  assert.equal(new Set(page.results.map((r) => r.id)).size, 12);
  assert.ok(page.results.every((r) => r.moodMatch && r.aiExplanation));
});

test('shuffle requests a new catalog page and returns a different set when more results exist', async (t) => {
  withoutGemini(t);
  const requestedPages: number[] = [];
  const loader = async ({ page = 1 }: { page?: number }) => {
    requestedPages.push(page);
    return Array.from({ length: 15 }, (_, i) => liveItem(`p${page}-${i}`, ['Mystery', 'Thriller']));
  };
  const first = await generateRecommendationPage({ moodSettings: twistMood, catalogLoader: loader });
  assert.equal(first.results.length, 12);
  assert.ok(first.nextCatalogPage > 1);

  const shuffled = await generateRecommendationPage({
    moodSettings: twistMood,
    catalogLoader: loader,
    catalogPage: first.nextCatalogPage,
    excludedMediaIds: first.results.map((r) => r.id),
  });
  assert.equal(shuffled.results.length, 12);
  const firstIds = new Set(first.results.map((r) => r.id));
  assert.ok(shuffled.results.every((r) => !firstIds.has(r.id)), 'shuffle must not repeat titles');
  assert.ok(Math.min(...requestedPages.slice(-2)) >= first.nextCatalogPage, 'shuffle starts at the next catalog page');
});

test('shuffle never repeats titles even when the catalog runs low', async (t) => {
  withoutGemini(t);
  const catalog = Array.from({ length: 15 }, (_, i) => liveItem(`only-${i}`, ['Drama']));
  const first = await generateRecommendationPage({ moodSettings: romanceMood, catalogLoader: async () => catalog });
  const shuffled = await generateRecommendationPage({
    moodSettings: romanceMood,
    catalogLoader: async () => catalog,
    catalogPage: first.nextCatalogPage,
    excludedMediaIds: first.results.map((r) => r.id),
  });
  assert.equal(shuffled.results.length, 3);
  assert.ok(shuffled.results.every((r) => !first.results.some((f) => f.id === r.id)));
});

test('result limit is respected and capped', async (t) => {
  withoutGemini(t);
  const catalog = Array.from({ length: 60 }, (_, i) => liveItem(`n-${i}`, ['Drama']));
  const six = await generateRecommendationPage({ moodSettings: romanceMood, resultLimit: 6, catalogLoader: async () => catalog });
  const huge = await generateRecommendationPage({ moodSettings: romanceMood, resultLimit: 999, catalogLoader: async () => catalog });
  assert.equal(six.results.length, 6);
  assert.equal(huge.results.length, 24);
});

test('strong sliders steer which catalog corner is fetched; a neutral mood does not', () => {
  assert.equal(moodCatalogHints({ darkness: 3, romance: 3, suspense: 3, plotTwists: 3, emotionalIntensity: 3 }), undefined);
  const romance = moodCatalogHints(romanceMood);
  assert.equal(romance?.movieGenres, '10749');
  assert.ok(romance?.bookSubjects.includes('romance'));
  const twists = moodCatalogHints(twistMood);
  assert.match(twists?.movieGenres ?? '', /53/);
  assert.ok(twists?.podcastTerms.includes('true crime'));
});

test('discovery signal and card reasons explain the strongest choices in plain language', () => {
  const signal = describeDiscoverySignal(twistMood);
  assert.match(signal.headline, /edge-of-your-seat suspense/);
  assert.ok(signal.favoring.some((line) => /thrillers, mysteries, crime and psychological/.test(line)));
  assert.ok(signal.avoiding.includes('romance-heavy stories'));
  const reason = explainMoodFit({ darkness: 3, romance: 1, suspense: 5, plotTwists: 5, emotionalIntensity: 3 }, twistMood, 0.9);
  assert.equal(reason, 'Strong match for suspense and plot twists, with little romance');
});
