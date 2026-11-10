// Near You: live podcast shows and nearby bookstores. Owner: Chloe.
// Data comes from /api/local/* (server/localService.ts). Location is only sent with the
// request and is never saved.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserSavedMedia } from '../lib/mediaService';
import {
  MapPin,
  Navigation,
  Ticket,
  BookOpen,
  Star,
  ExternalLink,
  Search,
  Radio,
  AlertCircle,
} from 'lucide-react';

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
  kind?: 'podcast' | 'comedy';
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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Try again in a minute.');
  return data as T;
}

export const NearYouPage: React.FC = () => {
  const { user } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [cityInput, setCityInput] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ events: boolean; bookstores: boolean } | null>(null);
  const [libraryPodcasts, setLibraryPodcasts] = useState<string[]>([]);
  const [events, setEvents] = useState<Section<LocalEvent>>(emptySection());
  const [eventsFallback, setEventsFallback] = useState(false);
  const [bookstores, setBookstores] = useState<Section<Bookstore>>(emptySection());

  // Which sources are set up on the server.
  useEffect(() => {
    fetchJson<{ events: boolean; bookstores: boolean }>('/api/local/status')
      .then(setStatus)
      .catch(() => setStatus({ events: false, bookstores: false }));
  }, []);

  // Podcasts in the user's library, so live shows of those podcasts show first.
  useEffect(() => {
    if (!user) {
      setLibraryPodcasts([]);
      return;
    }
    getUserSavedMedia(user.uid)
      .then((items) =>
        setLibraryPodcasts(
          (items || [])
            .filter((i) => i.mediaType === 'podcast' && i.status !== 'passed')
            .map((i) => i.title)
            .slice(0, 5)
        )
      )
      .catch(() => setLibraryPodcasts([]));
  }, [user]);

  // Load both sections whenever the place changes.
  useEffect(() => {
    if (!place) return;
    const query = placeQuery(place);

    setEvents({ loading: true, error: null, items: [] });
    setEventsFallback(false);
    const podcasts = libraryPodcasts.length ? `&podcasts=${encodeURIComponent(libraryPodcasts.join('|'))}` : '';
    fetchJson<{ events: LocalEvent[]; fallback?: boolean }>(`/api/local/events?${query}${podcasts}`)
      .then((d) => {
        setEventsFallback(Boolean(d.fallback));
        setEvents({ loading: false, error: null, items: d.events });
      })
      .catch((e) => setEvents({ loading: false, error: e.message, items: [] }));

    setBookstores({ loading: true, error: null, items: [] });
    fetchJson<{ bookstores: Bookstore[] }>(`/api/local/bookstores?${query}`)
      .then((d) => setBookstores({ loading: false, error: null, items: d.bookstores }))
      .catch((e) => setBookstores({ loading: false, error: e.message, items: [] }));
  }, [place, libraryPodcasts]);

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
        <h1 className="text-3xl font-serif font-bold text-[#F7F2E9]">Near You</h1>
        <p className="text-sm text-[#F7F2E9]/70 max-w-2xl">
          Live podcast shows coming to your area and bookstores nearby. Your location is only used for this
          search and is never saved.
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
          {user && libraryPodcasts.length > 0 && (
            <p className="text-xs text-[#F7F2E9]/50">
              We’ll check for live shows from {libraryPodcasts.slice(0, 3).join(', ')}
              {libraryPodcasts.length > 3 ? ' and more' : ''}.
            </p>
          )}
        </div>
      )}

      {place && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Live shows */}
          <section className="lg:col-span-3 space-y-4" aria-labelledby="live-shows-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="live-shows-heading" className="flex items-center gap-2 text-xl font-serif font-bold text-[#F7F2E9]">
                <Radio className="w-5 h-5 text-[#D9B66F]" /> {eventsFallback ? 'Live comedy shows' : 'Live podcast shows'}
              </h2>
              <span className="text-xs text-[#F7F2E9]/50">Near {place.label} · from Ticketmaster</span>
            </div>

            {events.loading && <p className="py-10 text-center text-sm text-[#D9B66F] animate-pulse">Finding live shows…</p>}
            {!events.loading && eventsFallback && events.items.length > 0 && (
              <p className="text-sm text-[#F7F2E9]/70 bg-[#10283F]/40 border border-[#10283F] rounded-xl px-4 py-3">
                No live podcast shows near {place.label} right now, so here are comedy shows nearby instead.
              </p>
            )}
            {events.error && <p className="py-6 text-sm text-[#F7F2E9]/70">{events.error}</p>}
            {!events.loading && !events.error && events.items.length === 0 && (
              <p className="py-6 text-sm text-[#F7F2E9]/60">No live podcast or comedy shows found nearby right now.</p>
            )}

            <div className="space-y-3">
              {events.items.map((ev) => (
                <article
                  key={ev.id}
                  className={`flex gap-4 p-4 rounded-xl border ${
                    ev.matchedPodcast ? 'bg-[#10283F]/60 border-[#D9B66F]/50' : 'bg-[#10283F]/30 border-[#10283F]'
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
                    {ev.matchedPodcast && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#D9B66F]">
                        From your library: {ev.matchedPodcast}
                      </span>
                    )}
                    <h3 className="font-serif font-bold text-[#F7F2E9] leading-snug">{ev.name}</h3>
                    <p className="text-xs text-[#F7F2E9]/70">{formatEventDate(ev.date, ev.time)}</p>
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
