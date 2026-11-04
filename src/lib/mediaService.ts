import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { SavedMediaItem, SwipeDecisionRecord } from '../types';

export async function saveMediaItem(
  item: Omit<SavedMediaItem, 'userId' | 'createdAt' | 'updatedAt' | 'id'>
): Promise<SavedMediaItem> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required to save media');

  const docId = `${currentUser.uid}_${item.mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `savedMedia/${docId}`;

  const now = new Date().toISOString();
  const fullItem: SavedMediaItem = {
    ...item,
    id: docId,
    userId: currentUser.uid,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, 'savedMedia', docId), fullItem, { merge: true });
    return fullItem;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateMediaStatus(
  mediaId: string,
  status: SavedMediaItem['status'],
  rating?: SavedMediaItem['rating'],
  userNotes?: string
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');

  const docId = `${currentUser.uid}_${mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `savedMedia/${docId}`;

  try {
    const payload: Partial<SavedMediaItem> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (rating !== undefined) payload.rating = rating;
    if (userNotes !== undefined) payload.userNotes = userNotes;

    await setDoc(doc(db, 'savedMedia', docId), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeSavedMedia(mediaId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required');

  const docId = `${currentUser.uid}_${mediaId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `savedMedia/${docId}`;

  try {
    await deleteDoc(doc(db, 'savedMedia', docId));
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
    const querySnapshot = await getDocs(q);
    const results: SavedMediaItem[] = [];
    querySnapshot.forEach((d) => {
      results.push(d.data() as SavedMediaItem);
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
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
