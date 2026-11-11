// Repeatable unauthenticated production smoke test. No secrets, cookies, or login tokens.
// Run: node scripts/production-smoke.mjs
const base = (process.env.PLOT_TWIST_BASE_URL || 'https://plot-twist-app.onrender.com').replace(/\/$/, '');
const failures = [];
const results = [];
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`HTTP ${response.status}: non-JSON response (${raw.slice(0, 80)})`);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || data.message || 'request failed'}`);
  return data;
}
async function check(name, operation, required = true) {
  try {
    const detail = await operation();
    results.push({ name, status: 'PASS', detail });
    console.log(`PASS ${name}: ${detail}`);
  } catch (error) {
    results.push({ name, status: required ? 'FAIL' : 'UNVERIFIED', detail: String(error.message || error) });
    if (required) failures.push(name);
    console.log(`${required ? 'FAIL' : 'UNVERIFIED'} ${name}: ${error.message || error}`);
  }
}
console.log(`Plot Twist production smoke: ${base} at ${new Date().toISOString()}`);
for (const [format, source] of [['movie', 'tmdb'], ['tv', 'tmdb'], ['book', 'google_books']]) {
  await check(`Live catalog: ${format}`, async () => {
    const data = await request(`/api/catalog?format=${format}`);
    if (!Array.isArray(data.catalog) || !data.catalog.length) throw new Error('empty catalog');
    if (!data.catalog.every((item) => item.mediaType === format)) throw new Error('format filter returned unrelated items');
    const live = data.catalog.filter((item) => item.catalogOrigin === 'live' && item.source === source);
    if (!live.length) throw new Error(`no live ${source} records; got ${data.catalog.length} catalog items`);
    return `${data.catalog.length} items, ${live.length} from live ${source}`;
  });
}
await check('Apple Podcasts search', async () => {
  const data = await request('/api/podcasts/search?q=science');
  if (data.source !== 'apple') throw new Error(`podcast source is ${data.source || 'unknown'}; should be Apple`);
  if (!Array.isArray(data.results) || !data.results.length) throw new Error('no podcast results');
  return `${data.results.length} results; reported source Apple (Apple network response not separately proven)`;
});
let localStatus;
await check('Near You configuration', async () => {
  localStatus = await request('/api/local/status');
  if (!localStatus.events) throw new Error('TICKETMASTER_API_KEY is not active');
  if (!localStatus.bookstores) throw new Error('GOOGLE_PLACES_API_KEY is not active');
  return 'events and bookstores credentials recognized by server';
});
if (localStatus?.events) {
  await check('Near You podcast/comedy fallback invariant', async () => {
    const data = await request('/api/local/events?city=New%20Orleans');
    if (!Array.isArray(data.events) || typeof data.fallback !== 'boolean') throw new Error('invalid events response');
    const expected = data.fallback ? 'comedy' : 'podcast';
    if (!data.events.every((item) => item.kind === expected)) throw new Error('fallback flag and event kinds disagree');
    return `${data.events.length} events, fallback=${data.fallback}; zero events does not prove fallback availability`;
  });
}
if (localStatus?.bookstores) {
  await check('Near You bookstores', async () => {
    const data = await request('/api/local/bookstores?city=New%20Orleans');
    if (!Array.isArray(data.bookstores)) throw new Error('invalid bookstores response');
    return `${data.bookstores.length} bookstore results`;
  });
}
await check('Recommendations response (NOT proof of Gemini)', async () => {
  const data = await request('/api/recommendations', 'POST', {
    moodSettings: { darkness: 3, romance: 2, suspense: 4, plotTwists: 4, emotionalIntensity: 3 },
    formats: ['movie'], ratingFeedback: { liked: [], disliked: [] },
  });
  if (!Array.isArray(data.results) || !data.results.length) throw new Error('no recommendations');
  if (!data.results.every((item) => item.mediaType === 'movie')) throw new Error('format filter bypassed');
  return `${data.results.length} verified movie recommendations; inspect Render logs for Gemini success versus fallback`;
}, false);
console.log('\n' + JSON.stringify({ base, total: results.length, failures, results }, null, 2));
if (failures.length) process.exitCode = 1;
