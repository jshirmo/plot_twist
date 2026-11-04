import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MediaType, TasteProfile } from '../types';
import { Check, ChevronRight, ChevronLeft, Sparkles, X, Plus } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STORY_GENRES = [
  'Mystery', 'Thriller', 'Romance', 'Comedy', 'Fantasy',
  'Science Fiction', 'Drama', 'Horror', 'Adventure',
  'Historical Fiction', 'Documentary', 'True Crime', 'Personal Development'
];

const MEDIA_FORMATS: { id: MediaType; label: string; desc: string }[] = [
  { id: 'movie', label: 'Movies', desc: 'Feature films & cinematic storytelling' },
  { id: 'tv', label: 'TV Shows', desc: 'Binge-worthy series & episodic drama' },
  { id: 'book', label: 'Books', desc: 'Novels, thrillers, and immersive literature' },
  { id: 'podcast', label: 'Podcasts', desc: 'Audio narratives, true crime & deep dives' }
];

const STORY_ELEMENTS = [
  'Surprising endings', 'Emotional depth', 'Strong characters', 'Humor',
  'Suspense', 'Romance', 'Thought-provoking themes', 'Comforting stories',
  'Fast pacing', 'World-building'
];

const TIME_OPTIONS = [
  'Under 30 minutes', '30–60 minutes', '1–2 hours', '2–3 hours', 'No preference'
];

const STREAMING_SERVICES = [
  'Netflix', 'Amazon Prime Video', 'Max', 'Hulu', 'Apple TV+', 'Disney+', 'Paramount+', 'Spotify'
];

const POPULAR_STORIES = [
  'Knives Out', 'Arrival', 'Parasite', 'Severance', 'Dark', 'The Silent Patient',
  'The Seven Husbands of Evelyn Hugo', 'Serial', 'Everything Everywhere All at Once'
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onComplete }) => {
  const { userProfile, saveUserProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form State
  const [preferredGenres, setPreferredGenres] = useState<string[]>(
    userProfile?.tasteProfile?.preferredGenres || ['Mystery', 'Science Fiction']
  );
  const [preferredFormats, setPreferredFormats] = useState<MediaType[]>(
    userProfile?.tasteProfile?.preferredFormats || ['movie', 'tv', 'book']
  );
  const [favoriteStories, setFavoriteStories] = useState<string[]>(
    userProfile?.tasteProfile?.favoriteStories || ['Knives Out', 'Severance']
  );
  const [customStoryInput, setCustomStoryInput] = useState('');
  const [storyElements, setStoryElements] = useState<string[]>(
    userProfile?.tasteProfile?.storyElements || ['Surprising endings', 'Emotional depth']
  );
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(
    userProfile?.tasteProfile?.dislikedGenres || []
  );
  const [timeAvailability, setTimeAvailability] = useState<string>(
    userProfile?.tasteProfile?.timeAvailability || '1–2 hours'
  );
  const [streamingServices, setStreamingServices] = useState<string[]>(
    userProfile?.tasteProfile?.streamingServices || ['Netflix', 'Max']
  );

  if (!isOpen) return null;

  const toggleItem = <T extends string>(list: T[], item: T, setter: (val: T[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const addCustomStory = () => {
    const trimmed = customStoryInput.trim();
    if (trimmed && !favoriteStories.includes(trimmed)) {
      setFavoriteStories([...favoriteStories, trimmed]);
      setCustomStoryInput('');
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const taste: TasteProfile = {
        preferredGenres,
        preferredFormats,
        favoriteStories,
        storyElements,
        dislikedGenres,
        timeAvailability,
        streamingServices,
        aiTasteSummary: `Drawn to ${preferredGenres.slice(0, 3).join(', ')} with an emphasis on ${storyElements.slice(0, 2).join(' & ')}.`,
        updatedAt: new Date().toISOString(),
      };

      if (userProfile) {
        await saveUserProfile({
          onboardingCompleted: true,
          tasteProfile: taste,
        });
      }

      onComplete();
    } catch (err) {
      console.error('Error saving onboarding questionnaire:', err);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#091A2B] border border-[#10283F] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header / Progress Bar */}
        <div className="p-6 border-b border-[#10283F] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F]">
              Question {step} of 7
            </span>
            <h2 className="text-xl font-serif font-bold text-[#F7F2E9]">
              {step === 1 && 'What kinds of stories do you love?'}
              {step === 2 && 'What media formats do you enjoy most?'}
              {step === 3 && 'What are some stories you already love?'}
              {step === 4 && 'What matters most to you in a story?'}
              {step === 5 && 'What do you prefer to avoid?'}
              {step === 6 && 'How much time do you usually have?'}
              {step === 7 && 'Which streaming services do you use?'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#F7F2E9]/60 hover:text-[#F7F2E9] rounded-lg transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator bar */}
        <div className="w-full bg-[#10283F] h-1.5">
          <div
            className="bg-[#D9B66F] h-1.5 transition-all duration-300"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Step 1: Genres */}
          {step === 1 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {STORY_GENRES.map((genre) => {
                const selected = preferredGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleItem(preferredGenres, genre, setPreferredGenres)}
                    className={`p-3 rounded-xl border text-sm font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
                      selected
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#F7F2E9] shadow-sm'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]/80'
                    }`}
                  >
                    <span>{genre}</span>
                    {selected && <Check className="w-4 h-4 text-[#D9B66F]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2: Formats */}
          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MEDIA_FORMATS.map((format) => {
                const selected = preferredFormats.includes(format.id);
                return (
                  <button
                    key={format.id}
                    onClick={() => toggleItem(preferredFormats, format.id, setPreferredFormats)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#F7F2E9]'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-base text-[#F7F2E9]">{format.label}</span>
                      {selected && <Check className="w-4 h-4 text-[#D9B66F]" />}
                    </div>
                    <p className="text-xs text-[#F7F2E9]/60">{format.desc}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 3: Favorite Stories */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-[#F7F2E9]/70">
                Choose from acclaimed titles or type in any real movie, book, TV show, or podcast you loved:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Inception, Gone Girl, The Matrix..."
                  value={customStoryInput}
                  onChange={(e) => setCustomStoryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomStory()}
                  className="flex-1 bg-[#10283F]/50 border border-[#10283F] rounded-lg px-3.5 py-2 text-sm text-[#F7F2E9] focus:outline-none focus:border-[#D9B66F]"
                />
                <button
                  onClick={addCustomStory}
                  className="px-4 py-2 bg-[#D9B66F] text-[#091A2B] font-semibold text-xs rounded-lg hover:bg-[#D9B66F]/90 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </button>
              </div>

              {/* Selected Stories */}
              {favoriteStories.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {favoriteStories.map((title) => (
                    <span
                      key={title}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#10283F] border border-[#D9B66F]/50 rounded-lg text-xs font-medium text-[#F7F2E9]"
                    >
                      {title}
                      <button
                        onClick={() => setFavoriteStories(favoriteStories.filter((s) => s !== title))}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Popular recommendations to pick */}
              <div className="pt-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#D9B66F] block mb-2">
                  Popular Favorites:
                </span>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_STORIES.map((title) => {
                    const isSelected = favoriteStories.includes(title);
                    return (
                      <button
                        key={title}
                        onClick={() => toggleItem(favoriteStories, title, setFavoriteStories)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                            : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]'
                        }`}
                      >
                        {title}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Story Elements */}
          {step === 4 && (
            <div className="grid grid-cols-2 gap-2.5">
              {STORY_ELEMENTS.map((element) => {
                const selected = storyElements.includes(element);
                return (
                  <button
                    key={element}
                    onClick={() => toggleItem(storyElements, element, setStoryElements)}
                    className={`p-3 rounded-xl border text-sm font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
                      selected
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#F7F2E9]'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]/80'
                    }`}
                  >
                    <span>{element}</span>
                    {selected && <Check className="w-4 h-4 text-[#D9B66F]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 5: What to avoid */}
          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs text-[#F7F2E9]/70">
                Select any genres you prefer not to see recommendations for (optional):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {STORY_GENRES.map((genre) => {
                  const selected = dislikedGenres.includes(genre);
                  return (
                    <button
                      key={genre}
                      onClick={() => toggleItem(dislikedGenres, genre, setDislikedGenres)}
                      className={`p-3 rounded-xl border text-sm font-medium text-left transition-all flex items-center justify-between cursor-pointer ${
                        selected
                          ? 'bg-red-950/40 border-red-500/80 text-red-200'
                          : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]/80'
                      }`}
                    >
                      <span>{genre}</span>
                      {selected && <X className="w-4 h-4 text-red-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 6: Available Time */}
          {step === 6 && (
            <div className="space-y-2.5">
              {TIME_OPTIONS.map((time) => {
                const selected = timeAvailability === time;
                return (
                  <button
                    key={time}
                    onClick={() => setTimeAvailability(time)}
                    className={`w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      selected
                        ? 'bg-[#10283F] border-[#D9B66F] text-[#F7F2E9]'
                        : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]/80'
                    }`}
                  >
                    <span className="font-medium text-sm text-[#F7F2E9]">{time}</span>
                    {selected && <Check className="w-4 h-4 text-[#D9B66F]" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 7: Streaming Services */}
          {step === 7 && (
            <div className="space-y-3">
              <p className="text-xs text-[#F7F2E9]/70">
                Select the streaming platforms you subscribe to for verified availability filters:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {STREAMING_SERVICES.map((service) => {
                  const selected = streamingServices.includes(service);
                  return (
                    <button
                      key={service}
                      onClick={() => toggleItem(streamingServices, service, setStreamingServices)}
                      className={`p-3 rounded-xl border text-sm font-medium text-center transition-all cursor-pointer ${
                        selected
                          ? 'bg-[#10283F] border-[#D9B66F] text-[#D9B66F]'
                          : 'bg-[#10283F]/30 border-[#10283F] text-[#F7F2E9]/70 hover:border-[#10283F]'
                      }`}
                    >
                      {service}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 sm:p-6 border-t border-[#10283F] flex items-center justify-between bg-[#091A2B]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#F7F2E9]/70 hover:text-[#F7F2E9] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {step < 7 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-semibold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-1.5 px-6 py-2.5 bg-[#D9B66F] hover:bg-[#D9B66F]/90 text-[#091A2B] font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Finish & Discover'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
