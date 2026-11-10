# Production Firebase release checklist (integration lead)

Plot Twist's public Firebase web configuration in `firebase-applet-config.json` identifies:

- **Firebase project:** `gold-pathway-cbcxw`
- **Named Firestore database:** `ai-studio-plottwist-4d494ee4-8f55-481a-9acc-b1ebf989ad10`
- **Production website:** `https://plot-twist-app.onrender.com`

Do not switch projects or databases using the old `feature/kai` branch. Do not commit any service-account JSON or API key.

## 1. Google sign-in

In the Firebase console, select project `gold-pathway-cbcxw`.
Open **Authentication → Settings → Authorized domains** and confirm `plot-twist-app.onrender.com` is listed. Enable Google sign-in under **Authentication → Sign-in method** if needed. Test an actual sign-in and sign-out in a private browser window.

## 2. Review and deploy group security rules

Only after PR #15's group security fix, the named-database configuration PR, and the final release PR are approved and merged into `main`:

1. In Firebase Console, open the **named** Firestore database above, view its current Rules, and review any differences from this repo's `firestore.rules` before overwriting.
2. Use an authenticated, authorized Firebase CLI session (do **not** paste authentication tokens into chat). From the checked-out latest `main`:

   ```bash
   npx firebase-tools@latest deploy --only firestore:rules --project gold-pathway-cbcxw
   ```

   The `firebase.json` file explicitly associates `firestore.rules` with the **named** database, so this operation must not target the project's default database.
3. Confirm in the Firebase console that the named database Rules reflect the new owner/self-join/self-leave restrictions.
4. Use two separate test accounts: create group, join by code, leave, and owner-delete; verify nonmembers cannot read groups and cannot edit group metadata. Remove test data afterward.

The Firestore Emulator CI job exercises six permission allow/deny cases. Emulator success is **not** evidence that the rules have been published to the hosted database.

## 3. Render verification

Render service: https://dashboard.render.com/web/srv-dbp2a9ek1f9s73arm6bg

- Production branch: `main`; build: `npm install && npm run build`; start: `npx tsx server.ts`.
- Check Environment **by variable name and present/absent status only**: `GEMINI_API_KEY`, `TMDB_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `TICKETMASTER_API_KEY`, `GOOGLE_PLACES_API_KEY`. Never post key values.
- Leave `PODCAST_INDEX_KEY` and `PODCAST_INDEX_SECRET` unset, to use Apple Podcasts.
- In GitHub Actions, manually run **Production API smoke** after deploying `main`, then separately check Render logs for Gemini model success vs local ranking.

## 4. Release decision

Do not call the public multi-user launch complete until live sign-in, Firestore persistence, approved rules deployment, and non-fallback Gemini ranking (if required) are verified.
