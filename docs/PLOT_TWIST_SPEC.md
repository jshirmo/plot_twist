# PLOT TWIST — COMPLETE SPECIFICATION

## Overview
Plot Twist is an AI-powered entertainment discovery platform that helps people decide what to read, watch, or listen to next across four major media formats:
1. Books (Google Books API)
2. Movies (TMDB API)
3. Television Shows (TMDB API)
4. Podcasts (Verified Podcast Search / Catalog)

The platform combines long-term taste preferences with in-the-moment mood sliders (Darkness, Romance, Suspense, Plot Twists, Emotional Intensity) and duration / streaming service filters.

## Core Features
1. Individual accounts with Google sign-in (Firebase Authentication).
2. Short initial taste-preference questionnaire (6-7 questions) with structured taste profile generation.
3. Personal profiles with saved preferences.
4. Gemini AI-powered recommendations engine evaluating verified catalog candidates.
5. Interactive mood and intensity sliders (1-5 scale for Darkness, Romance, Suspense, Plot Twists, Emotional Intensity).
6. Cross-media discovery (Books, Movies, TV, Podcasts) with runtime/episode duration filters and streaming provider filters.
7. Movie Swipe signature experience:
   - Swipe right (Interested / save to watchlist) or swipe left (Pass / record rejection).
   - Touch gestures, mouse drag, keyboard arrows, and explicit action buttons.
   - Robust Undo functionality updating Firestore state.
   - Refines future recommendation batches without spamming API calls.
8. Persistent personal library (Movie Watchlist, Books to Read, TV Watchlist, Podcasts to Listen To, Completed Media with enjoyment ratings, Passed Movies).
9. Group recommendations combining multiple users' taste profiles into balanced shared picks.
10. Camera scanning of book covers and movie/TV posters using Gemini vision, matching against catalog and providing compatibility scores.
11. Responsive, accessible desktop and mobile UI adhering to the cinematic palette (`#10283F`, `#091A2B`, `#D9B66F`, `#F7F2E9`, `#2C7A7B`).
12. Secure Firestore database with ABAC security rules and error handling.

## Visual Branding & Palette
- Deep navy: `#10283F`
- Dark navy: `#091A2B`
- Muted gold: `#D9B66F`
- Warm cream: `#F7F2E9`
- Soft teal: `#2C7A7B`
- Clean typography, high-impact poster artwork, zero-pill metadata, single-elevation cards.

## Phased Plan
- Phase 1: Foundation (Project structure, Homepage, Navigation, Firebase Auth, Cloud Firestore, Profiles, Onboarding Questionnaire)
- Phase 2: AI Recommendations & Catalogs (TMDB, Google Books, Podcasts, Gemini recommendation pipeline)
- Phase 3: Discover (Mood sliders, Filters, Recommendation cards, Saving)
- Phase 4: Movie Swipe (Card deck, Gestures, Buttons, History, Undo, Feedback)
- Phase 5: My Library (Watchlists, Completed, Passed, Feedback editing)
- Phase 6: Advanced Features (Groups, Group AI, Camera scanning with Gemini vision)
- Phase 7: Final Integration (Audit, Performance, Mobile polish, Verification)
