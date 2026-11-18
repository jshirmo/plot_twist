// Near You / "Stories Come Alive Near You": live events connected to the stories a user
// loves, plus nearby bookstores. Owner: Chloe.
// Data comes from /api/local/* (server/localService.ts, server/liveStories.ts). Location and
// library titles are only sent with the request and are never saved.

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserSavedMedia, getUserSwipeHistory } from '../lib/mediaService';
import type { MoodSettings } from '../types';
import {
  MapPin,
  Navigation,
  Ticket,
  BookOpen,
  Star,
  ExternalLink,
  Search,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

type EventBadge =
  | 'Live Podcast' | 'Book Adaptation' | 'Film Adaptation' | 'TV Experience' | 'On Stage' | 'Author Event'
  | 'Live Reading' | 'Screening' | 'Immersive' | 'Mystery Experience' | 'Comedy';

interface StoryContext {
  podcasts: string[];
  books: Array<{ title: string; author?: string }>;
  movies: string[];
  shows: string[];
  genres: string[];
  mood?: MoodSettings;
}

const EMPTY_CONTEXT: StoryContext = { podcasts: [], books: [], movies: [], shows: [], genres: [] };

const TABS: Array<{ id: string; label: string; badges?: EventBadge[] }> = [
  { id: 'all', label: 'All' },
  { id: 'podcasts', label: 'Podcasts', badges: ['Live Podcast'] },
  { id: 'books', label: 'Books', badges: ['Book Adaptation', 'Author Event', 'Live Reading'] },
  { id: 'screenings', label: 'Screenings', badges: ['Screening', 'Film Adaptation', 'TV Experience'] },
  { id: 'stage', label: 'Stage', badges: ['On Stage'] },
  { id: 'immersive', label: 'Immersive', badges: ['Immersive', 'Mystery Experience'] },
];

// Badges that come from a direct library match or an explicit adaptation get the gold style.
const HIGHLIGHT_BADGES: EventBadge[] = ['Book Adaptation', 'Film Adaptation', 'TV Experience'];

interface LocalEvent {
  id: string;
  name: string;
  url: string;
  date: string;
  time?: string;
  imageUrl?: string;
  venueName?: string;
  venueCity?: string;
  venueState?: string;
  distanceMiles?: number;
  category?: string;
  priceRange?: string;
  matchedPodcast?: string;
  matchedTitle?: string;
  kind?: string;
  badges?: EventBadge[];
  tier?: 'saved' | 'adaptation' | 'story' | 'taste' | 'comedy';
  reason?: string;
  moreDates?: number;
}

interface Bookstore {
  id: string;
  name: string;
  address: string;
  distanceMiles?: number;
  rating?: number;
  ratingCount?: number;
  openNow?: boolean;
  mapsUrl?: string;
  websiteUrl?: string;
}

type Place = { lat: number; lng: number; label: string } | { city: string; label: string };

interface Section<T> {
  loading: boolean;
  error: string | null;
  items: T[];
}

const emptySection = <T,>(): Section<T> => ({ loading: false, error: null, items: [] });

function placeBody(place: Place): { lat?: number; lng?: number; city?: string } {
  // Rounded to about 100 m before it leaves the browser.
  if ('city' in place) return { city: place.city };
  return { lat: Number(place.lat.toFixed(3)), lng: Number(place.lng.toFixed(3)) };
}

function placeQuery(place: Place): string {
  const params = new URLSearchParams();
  if ('city' in place) params.set('city', place.city);
  else {
    params.set('lat', place.lat.toFixed(3));
    params.set('lng', place.lng.toFixed(3));
  }
  return params.toString();
}

function formatEventDate(date: string, time?: string): string {
  if (!date) return 'Date to be announced';
  const d = new Date(`${date}T${time || '12:00:00'}`);
  if (Number.isNaN(d.getTime())) return date;
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (!time) return day;
  return `${day} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

async function fetchJson<T>(url: string, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(20000);
  const res = await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Try again in a minute.');
  return data as T;
}

export const NearYouPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ events: boolean; bookstores: boolean } | null>(null);
  const [storyContext, setStoryContext] = useState<StoryContext>(EMPTY_CONTEXT);
  const [events, setEvents] = useState<Section<LocalEvent>>(emptySection());
  const [eventsFallback, setEventsFallback] = useState(false);
  const [tab, setTab] = useState('all');
  const [bookstores, setBookstores] = useState<Section<Bookstore>>(emptySection());

  // Which sources are set up on the server.
  useEffect(() => {
    fetchJson<{ events: boolean; bookstores: boolean }>('/api/local/status')
      .then(setStatus)
      .catch(() => setStatus({ events: false, bookstores: false }));
  }, []);

  // What the user loves: saved titles (not passed or disliked), right swipes, preferred
  // genres, and the average mood of the titles they swiped right on.
  useEffect(() => {
    const genres = (userProfile?.tasteProfile?.preferredGenres || []).slice(0, 10);
    if (!user) {
      setStoryContext({ ...EMPTY_CONTEXT, genres });
      return;
    }
    let cancelled = false;
    Promise.all([
      getUserSavedMedia(user.uid).catch(() => []),
      getUserSwipeHistory(user.uid).catch(() => []),
    ]).then(([saved, swipes]) => {
      if (cancelled) return;
      const kept = (saved || []).filter((i) => i.status !== 'passed' && i.rating !== 'disliked');
      const liked = (swipes || []).filter((s) => s.decision === 'interested' && s.feedbackStatus === 'active');
      const titles = (type: string) => [...new Set([
        ...kept.filter((i) => i.mediaType === type).map((i) => i.title),
        ...liked.filter((s) => s.mediaType === type).map((s) => s.title),
      ])].slice(0, 15);
      const books = [
        ...kept.filter((i) => i.mediaType === 'book').map((i) => ({ title: i.title, author: i.creator })),
        ...liked.filter((s) => s.mediaType === 'book').map((s) => ({ title: s.title })),
      ].filter((b, i, all) => all.findIndex((x) => x.title === b.title) === i).slice(0, 15);
      const moods = liked.map((s) => s.moodTags).filter((m): m is MoodSettings => Boolean(m));
      const avg = (key: keyof MoodSettings) => Math.round((moods.reduce((sum, m) => sum + m[key], 0) / moods.length) * 10) / 10;
      setStoryContext({
        podcasts: titles('podcast'),
        books,
        movies: titles('movie'),
        shows: titles('tv'),
        genres,
        mood: moods.length >= 3
          ? { darkness: avg('darkness'), romance: avg('romance'), suspense: avg('suspense'), plotTwists: avg('plotTwists'), emotionalIntensity: avg('emotionalIntensity') }
          : undefined,
      });
    });
    return () => { cancelled = true; };
  }, [user, userProfile]);

  const savedCount = storyContext.podcasts.length + storyContext.books.length + storyContext.movies.length + storyContext.shows.length;

  // Load both sections whenever the place changes.
  useEffect(() => {
    if (!place) return;
    const query = placeQuery(place);
    const controller = new AbortController();

    setEvents({ loading: true, error: null, items: [] });
    setEventsFallback(false);
    setTab('all');
    fetchJson<{ events: LocalEvent[]; fallback?: boolean }>('/api/local/events', controller.signal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...placeBody(place), context: storyContext }),
    })
      .then((d) => {
        if (controller.signal.aborted) return;
        setEventsFallback(Boolean(d.fallback));
        setEvents({ loading: false, error: null, items: d.events });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setEvents({ loading: false, error: e.message, items: [] });
      });

    setBookstores({ loading: true, error: null, items: [] });
    fetchJson<{ bookstores: Bookstore[] }>(`/api/local/bookstores?${query}`, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) setBookstores({ loading: false, error: null, items: d.bookstores });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setBookstores({ loading: false, error: e.message, items: [] });
      });
    return () => controller.abort();
  }, [place, storyContext]);

  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((t) => [
    t.id,
    t.badges ? events.items.filter((ev) => ev.badges?.some((b) => t.badges!.includes(b))).length : events.items.length,
  ])), [events.items]);
  const activeTab = TABS.find((t) => t.id === tab) || TABS[0];
  const visibleEvents = activeTab.badges
    ? events.items.filter((ev) => ev.badges?.some((b) => activeTab.badges!.includes(b)))
    : events.items;

  const useMyLocation = () => {
    setLocationError(null);
    if (!('geolocation' in navigator)) {
      setLocationError('Your browser doesn’t share location. Enter a city instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' });
      },
      () => {
        setLocating(false);
        setLocationError('Location is turned off for this site. Enter a city instead.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  };

  const searchCity = (e: React.FormEvent) => {
    e.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    setLocationError(null);
    setPlace({ city, label: city });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-[#10283F] pb-6 space-y-2">
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">Stories Come Alive Near You</h1>
        <p className="text-sm text-[#F7F2E9]/70 max-w-2xl">
          See the stories you love come to life: live podcasts, stage adaptations, screenings, author events and
          immersive experiences near you, plus local bookstores. Your location is only used for this search and is
          never saved.
        </p>
      </div>

      {/* Location picker */}
      <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
        <button
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-[#D9B66F] text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-60"
        >
          <Navigation className="w-4 h-4" />
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
        <span className="text-xs text-[#F7F2E9]/50 text-center">or</span>
        <form onSubmit={searchCity} className="flex flex-1 gap-2">
          <label htmlFor="near-you-city" className="sr-only">
            City
          </label>
          <input
            id="near-you-city"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Enter a city, e.g. New Orleans"
            maxLength={80}
            className="flex-1 min-w-0 px-4 py-3 bg-[#091A2B] border border-[#10283F] rounded-xl text-sm text-[#F7F2E9] placeholder:text-[#F7F2E9]/40 focus:outline-none focus:border-[#D9B66F]"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-3 bg-[#10283F] border border-[#D9B66F]/40 text-[#D9B66F] rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </form>
      </div>

      {locationError && (
        <p className="flex items-center gap-2 text-sm text-[#D9B66F]">
          <AlertCircle className="w-4 h-4" /> {locationError}
        </p>
      )}

      {status && (!status.events || !status.bookstores) && (
        <p className="text-xs text-[#F7F2E9]/50">
          Setup note: {!status.events && 'live shows need TICKETMASTER_API_KEY'}
          {!status.events && !status.bookstores && ' and '}
          {!status.bookstores && 'bookstores need GOOGLE_PLACES_API_KEY'} in the server’s .env file.
        </p>
      )}

      {!place && (
        <div className="py-16 text-center space-y-3">
          <MapPin className="w-10 h-10 text-[#D9B66F] mx-auto" />
          <p className="text-sm text-[#F7F2E9]/70">Share your location or enter a city to see what’s near you.</p>
          {user && savedCount > 0 && (
            <p className="text-xs text-[#F7F2E9]/50">
              We’ll look for live events connected to{' '}
              {[...storyContext.podcasts, ...storyContext.books.map((b) => b.title), ...storyContext.movies, ...storyContext.shows]
                .slice(0, 3)
                .join(', ')}
              {savedCount > 3 ? ' and more from your library' : ''}.
            </p>
          )}
        </div>
      )}

      {place && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Live shows */}
          <section className="lg:col-span-3 space-y-4" aria-labelledby="live-shows-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 id="live-shows-heading" className="flex items-center gap-2 text-xl font-serif font-bold text-[#F7F2E9] whitespace-nowrap">
                <Sparkles className="w-5 h-5 text-[#D9B66F]" /> Live Plot Twist
              </h2>
              <span className="text-xs text-[#F7F2E9]/50">Near {place.label} · from Ticketmaster</span>
            </div>

            {!events.loading && !events.error && events.items.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Event types">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      tab === t.id
                        ? 'bg-[#D9B66F] border-[#D9B66F] text-[#091A2B]'
                        : 'bg-[#10283F]/40 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#D9B66F]/50'
                    }`}
                  >
                    {t.label} <span className="opacity-70">{tabCounts[t.id] ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            {events.loading && <p className="py-10 text-center text-sm text-[#D9B66F] animate-pulse">Finding stories near you…</p>}
            {!events.loading && eventsFallback && events.items.length > 0 && (
              <p className="text-sm text-[#F7F2E9]/70 bg-[#10283F]/40 border border-[#10283F] rounded-xl px-4 py-3">
                No direct story matches nearby right now. Here are live events that fit your Plot Twist taste.
              </p>
            )}
            {events.error && <p className="py-6 text-sm text-[#F7F2E9]/70">{events.error}</p>}
            {!events.loading && !events.error && events.items.length === 0 && (
              <p className="py-6 text-sm text-[#F7F2E9]/60">No live story events found near {place.label} right now.</p>
            )}
            {!events.loading && !events.error && events.items.length > 0 && visibleEvents.length === 0 && (
              <p className="py-6 text-sm text-[#F7F2E9]/60">Nothing in {activeTab.label} near {place.label} right now. Try another tab.</p>
            )}

            <div className="space-y-3">
              {visibleEvents.map((ev) => (
                <article
                  key={ev.id}
                  className={`flex gap-4 p-4 rounded-xl border ${
                    ev.tier === 'saved' ? 'bg-[#10283F]/60 border-[#D9B66F]/50' : 'bg-[#10283F]/30 border-[#10283F]'
                  }`}
                >
                  {ev.imageUrl && (
                    <img
                      src={ev.imageUrl}
                      alt=""
                      className="hidden sm:block w-32 h-20 object-cover rounded-lg bg-[#091A2B] shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    {(ev.matchedTitle || ev.matchedPodcast) && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#D9B66F]">
                        From your library: {ev.matchedTitle || ev.matchedPodcast}
                      </span>
                    )}
                    {ev.badges && ev.badges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ev.badges.map((b) => (
                          <span
                            key={b}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                              HIGHLIGHT_BADGES.includes(b)
                                ? 'bg-[#D9B66F] border-[#D9B66F] text-[#091A2B]'
                                : b === 'Comedy'
                                  ? 'bg-transparent border-[#F7F2E9]/20 text-[#F7F2E9]/60'
                                  : 'bg-[#091A2B] border-[#D9B66F]/40 text-[#D9B66F]'
                            }`}
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <h3 className="font-serif font-bold text-[#F7F2E9] leading-snug">{ev.name}</h3>
                    {ev.reason && <p className="text-xs italic text-[#F7F2E9]/80">{ev.reason}</p>}
                    <p className="text-xs text-[#F7F2E9]/70">
                      {formatEventDate(ev.date, ev.time)}
                      {ev.moreDates ? ` · +${ev.moreDates} more ${ev.moreDates === 1 ? 'date' : 'dates'}` : ''}
                    </p>
                    <p className="text-xs text-[#F7F2E9]/50">
                      {[ev.venueName, [ev.venueCity, ev.venueState].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                      {ev.distanceMiles !== undefined && ` · ${ev.distanceMiles} mi`}
                      {ev.priceRange && ` · ${ev.priceRange}`}
                    </p>
                  </div>
                  <a
                    href={ev.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-center flex items-center gap-1.5 px-3 py-2 bg-[#D9B66F] text-[#091A2B] rounded-lg text-xs font-bold shrink-0"
                  >
                    <Ticket className="w-4 h-4" /> Tickets
                  </a>
                </article>
              ))}
            </div>
          </section>

          {/* Bookstores */}
          <section className="lg:col-span-2 space-y-4" aria-labelledby="bookstores-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="bookstores-heading" className="flex items-center gap-2 text-xl font-serif font-bold text-[#F7F2E9]">
                <BookOpen className="w-5 h-5 text-[#D9B66F]" /> Bookstores
              </h2>
              <span className="text-xs text-[#F7F2E9]/50">Results from Google</span>
            </div>

            {bookstores.loading && <p className="py-10 text-center text-sm text-[#D9B66F] animate-pulse">Finding bookstores…</p>}
            {bookstores.error && <p className="py-6 text-sm text-[#F7F2E9]/70">{bookstores.error}</p>}
            {!bookstores.loading && !bookstores.error && bookstores.items.length === 0 && (
              <p className="py-6 text-sm text-[#F7F2E9]/60">No bookstores found nearby.</p>
            )}

            <div className="space-y-3">
              {bookstores.items.map((b) => (
                <article key={b.id} className="p-4 rounded-xl bg-[#10283F]/30 border border-[#10283F] space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-serif font-bold text-[#F7F2E9] leading-snug">{b.name}</h3>
                    {b.distanceMiles !== undefined && (
                      <span className="text-xs font-semibold text-[#D9B66F] shrink-0">{b.distanceMiles} mi</span>
                    )}
                  </div>
                  <p className="text-xs text-[#F7F2E9]/60">{b.address}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#F7F2E9]/70">
                    {b.rating !== undefined && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#D9B66F]" /> {b.rating.toFixed(1)}
                        {b.ratingCount ? ` (${b.ratingCount})` : ''}
                      </span>
                    )}
                    {b.openNow !== undefined && (
                      <span className={b.openNow ? 'text-[#5FB3B4]' : 'text-[#F7F2E9]/50'}>
                        {b.openNow ? 'Open now' : 'Closed now'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 pt-1">
                    {b.mapsUrl && (
                      <a
                        href={b.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-[#D9B66F]"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Directions
                      </a>
                    )}
                    {b.websiteUrl && (
                      <a
                        href={b.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-[#F7F2E9]/70"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
