import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Compass, Layers, Film, BookOpen, Tv, Radio, Sparkles, Users, Camera, ArrowRight, CheckCircle2 } from 'lucide-react';

interface HomePageProps {
  onNavigate: (tab: string) => void;
  onOpenOnboarding: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenOnboarding }) => {
  const { user, userProfile, signIn } = useAuth();

  const handleFindNextFavorite = () => {
    if (!userProfile?.onboardingCompleted) {
      onOpenOnboarding();
    } else {
      onNavigate('discover');
    }
  };

  const handleStartSwiping = () => {
    onNavigate('swipe');
  };

  return (
    <div className="min-h-screen bg-[#091A2B] text-[#F7F2E9] selection:bg-[#D9B66F] selection:text-[#091A2B]">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 border-b border-[#10283F]">
        {/* Subtle cinematic gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#10283F]/30 via-transparent to-[#091A2B] pointer-events-none" />
        <div className="absolute -top-40 right-1/4 w-96 h-96 bg-[#2C7A7B]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-10 w-80 h-80 bg-[#D9B66F]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#10283F] border border-[#D9B66F]/40 rounded-full text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Entertainment Discovery</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight text-[#F7F2E9] max-w-4xl mx-auto leading-tight">
            What’s Your <span className="text-[#D9B66F] italic">Plot</span> Today?
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-[#F7F2E9]/80 max-w-2xl mx-auto font-normal leading-relaxed">
            Discover your next favorite book, movie, show, or podcast based on your mood, your taste, and the stories you love.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleFindNextFavorite}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-bold text-sm tracking-wide rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Compass className="w-4 h-4 group-hover:rotate-45 transition-transform" />
              <span>Find My Next Favorite</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleStartSwiping}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#10283F] hover:bg-[#10283F]/80 text-[#F7F2E9] border border-[#D9B66F]/50 font-semibold text-sm tracking-wide rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-[#D9B66F]" />
              <span>Start Swiping</span>
            </button>
          </div>

          {/* Formats Strip */}
          <div className="pt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs uppercase tracking-widest text-[#F7F2E9]/60 font-medium">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-[#D9B66F]" />
              <span>Movies</span>
            </div>
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-[#D9B66F]" />
              <span>TV Series</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#D9B66F]" />
              <span>Books</span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#D9B66F]" />
              <span>Podcasts</span>
            </div>
          </div>
        </div>
      </section>

      {/* How Plot Twist Works Section */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-[#10283F]">
        <div className="text-center space-y-3 mb-14">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
            Simple & Intuitive
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#F7F2E9]">
            How Plot Twist Works
          </h2>
          <p className="text-sm text-[#F7F2E9]/70 max-w-xl mx-auto">
            From how you feel right now to the deep narrative tropes you love, we curate across all mediums.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#10283F]/40 border border-[#10283F] rounded-2xl p-8 space-y-4 hover:border-[#D9B66F]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#10283F] flex items-center justify-center text-xl font-bold font-serif text-[#D9B66F] border border-[#D9B66F]/30">
              01
            </div>
            <h3 className="text-lg font-serif font-bold text-[#F7F2E9]">Tell Us What You Love</h3>
            <p className="text-sm text-[#F7F2E9]/70 leading-relaxed">
              Complete a quick 2-minute taste questionnaire or pick your all-time favorite stories to establish your unique taste profile.
            </p>
          </div>

          <div className="bg-[#10283F]/40 border border-[#10283F] rounded-2xl p-8 space-y-4 hover:border-[#D9B66F]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#10283F] flex items-center justify-center text-xl font-bold font-serif text-[#D9B66F] border border-[#D9B66F]/30">
              02
            </div>
            <h3 className="text-lg font-serif font-bold text-[#F7F2E9]">Set Your Mood</h3>
            <p className="text-sm text-[#F7F2E9]/70 leading-relaxed">
              Dial in your exact mood using five distinct sliders: Darkness, Romance, Suspense, Plot Twists, and Emotional Intensity.
            </p>
          </div>

          <div className="bg-[#10283F]/40 border border-[#10283F] rounded-2xl p-8 space-y-4 hover:border-[#D9B66F]/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#10283F] flex items-center justify-center text-xl font-bold font-serif text-[#D9B66F] border border-[#D9B66F]/30">
              03
            </div>
            <h3 className="text-lg font-serif font-bold text-[#F7F2E9]">Discover Your Next Obsession</h3>
            <p className="text-sm text-[#F7F2E9]/70 leading-relaxed">
              Gemini AI evaluates verified catalog candidates and returns bespoke recommendations with clear, spoiler-free explanations.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 1: More Than Just Movies */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-[#10283F]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#2C7A7B]">
              <Layers className="w-4 h-4" />
              <span>Cross-Format Discovery</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#F7F2E9]">
              More Than Just Movies
            </h2>
            <p className="text-sm sm:text-base text-[#F7F2E9]/80 leading-relaxed">
              Most platforms keep books, movies, and podcasts isolated. If you loved the claustrophobic mystery of <span className="text-[#D9B66F] italic">Knives Out</span>, Plot Twist can instantly recommend a twist-heavy thriller novel, a mind-bending TV series, or a gripping investigative true-crime podcast.
            </p>
            <ul className="space-y-3 text-sm text-[#F7F2E9]/70">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#D9B66F]" />
                <span>Filters by actual runtime, page count, and episode length</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#D9B66F]" />
                <span>Verified streaming service availability</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#D9B66F]" />
                <span>Identifies narrative parallels across different art forms</span>
              </li>
            </ul>
            <button
              onClick={() => onNavigate('discover')}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D9B66F] hover:text-[#D9B66F]/80 transition-colors cursor-pointer"
            >
              <span>Explore Discover Feed</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-6 grid grid-cols-2 gap-4">
            <div className="bg-[#091A2B] border border-[#10283F] rounded-xl p-4 space-y-2">
              <span className="text-xs text-[#D9B66F] font-semibold uppercase">Movie</span>
              <h4 className="font-serif font-bold text-sm text-[#F7F2E9]">Knives Out</h4>
              <p className="text-xs text-[#F7F2E9]/60 line-clamp-2">Clever whodunit with eccentric detective and family greed.</p>
            </div>
            <div className="bg-[#091A2B] border border-[#10283F] rounded-xl p-4 space-y-2">
              <span className="text-xs text-[#2C7A7B] font-semibold uppercase">Book</span>
              <h4 className="font-serif font-bold text-sm text-[#F7F2E9]">The Silent Patient</h4>
              <p className="text-xs text-[#F7F2E9]/60 line-clamp-2">Psychological suspense with an unforgettable sudden climax.</p>
            </div>
            <div className="bg-[#091A2B] border border-[#10283F] rounded-xl p-4 space-y-2">
              <span className="text-xs text-[#D9B66F] font-semibold uppercase">TV Series</span>
              <h4 className="font-serif font-bold text-sm text-[#F7F2E9]">Severance</h4>
              <p className="text-xs text-[#F7F2E9]/60 line-clamp-2">Corporate paranoia and divided memories.</p>
            </div>
            <div className="bg-[#091A2B] border border-[#10283F] rounded-xl p-4 space-y-2">
              <span className="text-xs text-[#2C7A7B] font-semibold uppercase">Podcast</span>
              <h4 className="font-serif font-bold text-sm text-[#F7F2E9]">Serial (Season 1)</h4>
              <p className="text-xs text-[#F7F2E9]/60 line-clamp-2">Deep investigative mystery exploring every angle of truth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Movie Swipe */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 border-b border-[#10283F]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-8 text-center space-y-4">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#10283F] border border-[#D9B66F]/40 text-xs text-[#D9B66F] font-semibold">
              Right = Save to Watchlist · Left = Pass
            </div>
            <div className="relative mx-auto w-64 h-80 rounded-2xl overflow-hidden border-2 border-[#D9B66F]/40 shadow-2xl bg-[#091A2B]">
              <img
                src="https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg"
                alt="Parasite"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4 text-left">
                <span className="text-xs text-[#D9B66F] font-semibold">96% Match Estimate</span>
                <h4 className="font-serif font-bold text-lg text-white">Parasite (2019)</h4>
                <p className="text-xs text-white/80 line-clamp-2">High-suspense dark comedy about class divisions.</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
              <Layers className="w-4 h-4" />
              <span>Interactive Decision Deck</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#F7F2E9]">
              Swipe Into Something New
            </h2>
            <p className="text-sm sm:text-base text-[#F7F2E9]/80 leading-relaxed">
              Tired of endless scrolling? Use our signature Movie Swipe interface to rapidly build your personalized watchlist. Swiping right automatically saves the film to your Firestore Watchlist, while swiping left tunes out unwanted styles. Accidental swipe? Tap Undo anytime.
            </p>
            <button
              onClick={handleStartSwiping}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              <span>Launch Movie Swipe Deck</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Feature 3: Better Together & Camera Scanner */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-8 space-y-4">
            <Users className="w-8 h-8 text-[#D9B66F]" />
            <h3 className="text-2xl font-serif font-bold text-[#F7F2E9]">Better Together</h3>
            <p className="text-sm text-[#F7F2E9]/70 leading-relaxed">
              Can’t agree on movie night or book club? Create a group, invite friends with a single code, and let Gemini AI generate compromise recommendations that satisfy everyone’s distinct taste profiles.
            </p>
            <button
              onClick={() => onNavigate('groups')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#D9B66F] hover:text-[#D9B66F]/80 pt-2 cursor-pointer"
            >
              <span>Manage Groups</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#10283F]/30 border border-[#10283F] rounded-2xl p-8 space-y-4">
            <Camera className="w-8 h-8 text-[#2C7A7B]" />
            <h3 className="text-2xl font-serif font-bold text-[#F7F2E9]">See It. Scan It. Discover It.</h3>
            <p className="text-sm text-[#F7F2E9]/70 leading-relaxed">
              Spotted a compelling book at the bookstore or a poster at the cinema? Snap a photo with your phone. Gemini vision recognizes the title and evaluates its compatibility against your personal taste.
            </p>
            <button
              onClick={() => onNavigate('scan')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#2C7A7B] hover:text-[#2C7A7B]/80 pt-2 cursor-pointer"
            >
              <span>Open Scanner</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Call to action footer banner */}
      <section className="py-16 bg-[#10283F]/60 border-t border-[#10283F] text-center">
        <div className="max-w-3xl mx-auto px-4 space-y-6">
          <h2 className="text-3xl font-serif font-bold text-[#F7F2E9]">
            Ready to find what you should watch, read, or listen to next?
          </h2>
          <button
            onClick={handleFindNextFavorite}
            className="px-8 py-3.5 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-bold text-sm tracking-wide rounded-xl shadow-lg transition-all cursor-pointer"
          >
            Find My Next Favorite
          </button>
        </div>
      </section>
    </div>
  );
};
