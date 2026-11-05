import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { TasteProfile } from '../src/types';

function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (encodedServiceAccount) {
    try {
      return initializeApp({ credential: cert(JSON.parse(encodedServiceAccount)) });
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }

  // Cloud Run and Firebase App Hosting can use an attached service account.
  return initializeApp({ credential: applicationDefault() });
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 20)
    : [];
}

function sanitizeTasteProfile(value: unknown): TasteProfile {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    preferredGenres: cleanStringArray(raw.preferredGenres),
    preferredFormats: cleanStringArray(raw.preferredFormats).filter((format) =>
      ['movie', 'tv', 'book', 'podcast'].includes(format)
    ) as TasteProfile['preferredFormats'],
    favoriteStories: cleanStringArray(raw.favoriteStories),
    storyElements: cleanStringArray(raw.storyElements),
    dislikedGenres: cleanStringArray(raw.dislikedGenres),
    timeAvailability: typeof raw.timeAvailability === 'string' ? raw.timeAvailability : '',
    streamingServices: cleanStringArray(raw.streamingServices),
    aiTasteSummary: typeof raw.aiTasteSummary === 'string' ? raw.aiTasteSummary.slice(0, 500) : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

export async function getAuthenticatedProfile(authorization?: string): Promise<{
  userId: string;
  tasteProfile: TasteProfile;
}> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) throw new Error('Authentication required. Sign in and try again.');

  const app = getFirebaseAdminApp();
  const decoded = await getAuth(app).verifyIdToken(token);
  const profileSnapshot = await getFirestore(app).collection('users').doc(decoded.uid).get();
  const data = profileSnapshot.data();

  return { userId: decoded.uid, tasteProfile: sanitizeTasteProfile(data?.tasteProfile) };
}
