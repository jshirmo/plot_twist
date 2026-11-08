import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { MediaType, SavedMediaItem, SwipeDecisionRecord } from '../types';

// New saves include the format so a TMDB movie and TV show with the same ID
// cannot overwrite one another. Existing untyped records remain accessible.
function mediaDocumentId(userId: string, mediaId: string, mediaType?: MediaType): string {
  return [userId, mediaType, mediaId].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function findSavedDocument(userId: string, mediaId: string, mediaType?: MediaType) {
  const types: MediaType[] = mediaType ? [mediaType] : ['movie'];
  for (const type of types) {
    const typedRef = doc(db, 'savedMedia', mediaDocumentId(userId, mediaId, type));
    if ((await getDoc(typedRef)).exists()) return typedRef;
  }

  const legacyRef = doc(db, 'savedMedia', mediaDocumentId(userId, mediaId));
  const legacy = await getDoc(legacyRef);
  if (legacy.exists() && (!mediaType || legacy.data().mediaType === mediaType)) {
    return legacyRef;
  }
  return null;
}

export async function saveMediaItem(
  item: Omit<SavedMediaItem, 'userId' | 'createdAt' | 'updatedAt' | 'id'>
): Promise<SavedMediaItem> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required to save media');

  const path = 'savedMedia';
  try {
    const existingRef = await findSavedDocument(currentUser.uid, item.mediaId, item.mediaType);
    const itemRef = existingRef ?? doc(db, path, mediaDocumentId(currentUser.uid, item.mediaId, item.mediaType));
    const existingSnapshot = existingRef ? await getDoc(existingRef) : null;
    const existing = existingSnapshot?.exists() ? existingSnapshot.data() as SavedMediaItem : null;
    const now = new Date().toISOString();

    const fullItem: SavedMediaItem = {
      ...item,
      id: itemRef.id,
      userId: currentUser.uid,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      // Saving the same title again must not erase a completed review.
      ...(existing?.status === 'completed' ? { status: 'completed' as const } : {}),
      ...(existing?.rating ? { rating: existing.rating } : {}),
    };

    await setDoc(itemRef, fullItem, { merge: true });
    return fullItem;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateMediaStatus(
  mediaId: string,
  status: SavedMediaItem['status'],
  rating?: SavedMediaItem['rating'],
  userNotes?: string,
  mediaType?: MediaType
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');

  const path = 'savedMedia';
  try {
    const itemRef = await findSavedDocument(currentUser.uid, mediaId, mediaType);
    if (!itemRef) throw new Error('Saved title not found in your library.');

    const payload: Partial<SavedMediaItem> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (rating !== undefined) payload.rating = rating;
    if (userNotes !== undefined) payload.userNotes = userNotes;

    // updateDoc rejects missing documents rather than creating incomplete records.
    await updateDoc(itemRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeSavedMedia(mediaId: string, mediaType?: MediaType): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');

  const path = 'savedMedia';
  try {
    const itemRef = await findSavedDocument(currentUser.uid, mediaId, mediaType);
    if (itemRef) await deleteDoc(itemRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getUserSavedMedia(userId: string): Promise<SavedMediaItem[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error('Access denied: can only read your own saved media');
  }

  const path = 'savedMedia';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data() as SavedMediaItem, id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// Request contract proposed to Ben: only completed Liked/Disliked titles count.
// Keep user data in this existing savedMedia collection; no new Firestore fields.
export interface RatedTitleFeedback {
  title: string;
  mediaType: MediaType;
  genres: string[];
}

export interface RecommendationRatingFeedback {
  liked: RatedTitleFeedback[];
  disliked: RatedTitleFeedback[];
}

export async function getUserRatingFeedback(userId: string): Promise<RecommendationRatingFeedback> {
  const saved = await getUserSavedMedia(userId);
  const feedback: RecommendationRatingFeedback = { liked: [], disliked: [] };
  for (const item of saved) {
    if (item.status !== 'completed') continue;
    if (item.rating !== 'liked' && item.rating !== 'disliked') continue;
    feedback[item.rating].push({
      title: item.title,
      mediaType: item.mediaType,
      genres: item.genres ?? [],
    });
  }
  return feedback;
}

export async function recordSwipeDecision(
  swipe: Omit<SwipeDecisionRecord, 'userId' | 'createdAt' | 'id'>
): Promise<SwipeDecisionRecord> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required to record swipe');

  const docId = `${currentUser.uid}_${swipe.mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `swipeHistory/${docId}`;
  const now = new Date().toISOString();

  const record: SwipeDecisionRecord = {
    ...swipe,
    id: docId,
    userId: currentUser.uid,
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'swipeHistory', docId), record);

    // If swipe was 'interested', also automatically add to Movie Watchlist in savedMedia!
    if (swipe.decision === 'interested') {
      await saveMediaItem({
        mediaId: swipe.mediaId,
        mediaType: 'movie',
        title: swipe.title,
        posterUrl: swipe.posterUrl,
        genres: swipe.genres,
        status: 'watchlist',
        source: 'tmdb',
      });
    }

    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function undoLastSwipeDecision(userId: string): Promise<SwipeDecisionRecord | null> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error('Access denied: can only undo your own swipe');
  }

  const path = 'swipeHistory';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId),
      where('feedbackStatus', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const lastDoc = snap.docs[0];
    const data = lastDoc.data() as SwipeDecisionRecord;

    // Mark feedback as reversed
    await setDoc(doc(db, 'swipeHistory', lastDoc.id), { feedbackStatus: 'reversed' }, { merge: true });

    // If it was interested, remove from watchlist or update status
    if (data.decision === 'interested') {
      await removeSavedMedia(data.mediaId);
    }

    return { ...data, feedbackStatus: 'reversed' };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function getUserSwipeHistory(userId: string): Promise<SwipeDecisionRecord[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error('Access denied: can only read your own swipe history');
  }

  const path = 'swipeHistory';
  try {
    const q = query(collection(db, path), where('userId', '==', userId));
    const snap = await getDocs(q);
    const records: SwipeDecisionRecord[] = [];
    snap.forEach((d) => records.push(d.data() as SwipeDecisionRecord));
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
