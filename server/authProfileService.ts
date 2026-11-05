import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TasteProfile } from '../src/types';

type FirebaseAppletConfig = {
  projectId?: string;
  firestoreDatabaseId?: string;
};

let cachedFirebaseConfig: FirebaseAppletConfig | undefined;

function getFirebaseAppletConfig(): FirebaseAppletConfig {
  if (cachedFirebaseConfig) return cachedFirebaseConfig;

  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    resolve(process.cwd(), 'firebase-applet-config.json'),
    resolve(moduleDirectory, '..', 'firebase-applet-config.json'),
  ];
  const configPath = candidatePaths.find((path) => existsSync(path));
  if (!configPath) throw new Error('firebase-applet-config.json was not found.');

  cachedFirebaseConfig = JSON.parse(readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;
  return cachedFirebaseConfig;
}

export function getFirestoreDatabaseId(): string {
  const databaseId = getFirebaseAppletConfig().firestoreDatabaseId;
  if (!databaseId) throw new Error('Firestore database ID is not configured.');
  return databaseId;
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const config = getFirebaseAppletConfig();
  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (encodedServiceAccount) {
    try {
      return initializeApp({
        credential: cert(JSON.parse(encodedServiceAccount)),
        projectId: config.projectId,
      });
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }

  // Cloud Run and Firebase App Hosting can use an attached service account.
  return initializeApp({ credential: applicationDefault(), projectId: config.projectId });
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
  const profileSnapshot = await getFirestore(app, getFirestoreDatabaseId())
    .collection('users')
    .doc(decoded.uid)
    .get();
  const data = profileSnapshot.data();

  return { userId: decoded.uid, tasteProfile: sanitizeTasteProfile(data?.tasteProfile) };
}
