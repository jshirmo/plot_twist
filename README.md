# Plot Twist — AI-Powered Cross-Media Entertainment Discovery

**Plot Twist** is an AI-powered entertainment discovery platform that helps you decide what to read, watch, or listen to next across **Books, Movies, Television Shows, and Podcasts**.

Instead of isolating media formats, Plot Twist connects stories through mood and narrative elements. For example, if you love a twist-heavy, claustrophobic mystery like *Knives Out*, Plot Twist can recommend an acclaimed thriller novel, a binge-worthy drama series, or an investigative podcast that evokes the same feeling.

---

## Key Features

1. **Individual Accounts with Google Sign-In**:
   - Built on Firebase Authentication.
   - Individual user data, watchlists, completed reviews, and swipe history are isolated per user UID.

2. **Taste-Preference Questionnaire**:
   - 7-question onboarding experience establishing preferred genres, formats, favorite stories, disliked tropes, available time, and streaming providers.
   - Saves structured taste profiles directly to Cloud Firestore.

3. **Gemini AI Recommendation Engine**:
   - The browser sends only the live mood sliders and filters with a Firebase ID token. The Express server verifies the token, reads that user's saved Firestore taste profile, collects live catalog candidates, then asks Gemini to rank those candidates.
   - TMDB supplies movie/TV IDs, runtime, and region-specific streaming metadata; Google Books supplies book volume IDs and page counts; Apple Podcasts supplies verified podcast catalog IDs.
   - Every Gemini response is checked against the candidates returned by those catalogs. If Gemini fails or times out, a local ranker returns only those same verified candidates.
   - Returns a **Plot Twist Match Estimate (%)** and personalized, spoiler-free explanation.

4. **Interactive Mood Sliders**:
   - 5-axis 1–5 scale: **Darkness**, **Romance**, **Suspense**, **Plot Twists**, and **Emotional Intensity**.
   - Filters by actual runtime, page count, episode length, and streaming provider availability.

5. **Movie Swipe (Signature Experience)**:
   - Tinder-style swipe interface with finger swipe, mouse drag, and keyboard arrow controls.
   - **Right Swipe**: Saves film to your Firestore Watchlist and refines future recommendations.
   - **Left Swipe**: Records pass feedback to avoid repeating unwanted styles.
   - **Undo**: Restores previous card and synchronizes database state.

6. **My Library**:
   - Organized collections for **Movie Watchlist**, **Books to Read**, **TV Watchlist**, **Podcasts to Listen**, **Completed Media** (with Liked/Disliked ratings), and **Passed Movies**.

7. **Group Recommendations**:
   - Create groups, generate 6-character invite codes, and let Gemini AI find compromise picks that satisfy multiple members.

8. **Camera & Poster Scanner**:
   - Photograph or upload any book cover or movie poster. Gemini vision identifies the title and computes a compatibility score against your personal profile.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion (Framer Motion), Lucide React.
- **Backend / Server**: Node.js, Express, Vite middleware.
- **AI**: Google Gemini API (`@google/genai` TypeScript SDK, `gemini-3.8-flash`).
- **Database**: Google Cloud Firestore (Enterprise Edition with ABAC security rules).
- **Authentication**: Firebase Authentication (Google Sign-In).
- **Catalogs**: TMDB (Movies & TV), Google Books (Literature), Verified Podcasts.

---

## Connecting to Your GitHub Repository

### Option 1: Direct Export in AI Studio
1. In Google AI Studio Build, click the **Export** / **GitHub** button in the upper right toolbar.
2. Select your preexisting GitHub repository name.
3. Click **Push / Export**.

### Option 2: Command Line (Local Machine)
If you download or clone this workspace:
```bash
# 1. Initialize git
git init

# 2. Stage all files
git add .

# 3. Commit
git commit -m "feat: Initial commit for Plot Twist platform"

# 4. Set main branch
git branch -M main

# 5. Link your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# 6. Push code to GitHub
git push -u origin main
```

---

## Local Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set the server-only values listed in `.env.example`:

- `GEMINI_API_KEY` (Google AI Studio API key)
- one of `TMDB_API_READ_ACCESS_TOKEN` or `TMDB_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON` for local development, or an attached server service account in Cloud Run/Firebase App Hosting
- optionally `GOOGLE_BOOKS_API_KEY` for quota control

Do not use `VITE_` for any of these secrets. The public Firebase web configuration is separate from the Admin credential used by the server.

### Team / multiple-computer setup

Use one shared development deployment, not personal API keys on each laptop. Store Gemini, TMDB, and Firebase Admin credentials only in that deployment's secrets manager. Teammates clone the GitHub branch and set only the non-secret `VITE_API_BASE_URL` to the shared development API URL. Keep it blank when the app frontend and Express API deploy together. If they are separate, set `CORS_ALLOWED_ORIGINS` on the API to the exact frontend URLs allowed to send bearer tokens. Firebase's client configuration and the API URL are public identifiers; the Admin credential and catalog/AI keys are not.

### 3. Run Development Server
```bash
npm run dev
```
The application will be live at `http://localhost:3000`.

### 4. Run Unit Tests
```bash
npm test
```

### 5. Production Build
```bash
npm run build
npm start
```

---

## Architecture & Security Specifications

- **Complete Specification**: See [`docs/PLOT_TWIST_SPEC.md`](docs/PLOT_TWIST_SPEC.md) for the full requirements breakdown.
- **Status & Acceptance Criteria**: See [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) for the current progress and verification status.
- **Security Rules**: Security invariants and threat model are defined in `security_spec.md` and enforced in `firestore.rules`.
