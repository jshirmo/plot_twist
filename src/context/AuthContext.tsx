import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logoutUser, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveUserProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test connection on initial boot
    testConnection().catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (currentUser: User) => {
    const path = `users/${currentUser.uid}`;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setUserProfile(userSnap.data() as UserProfile);
      } else {
        // Initialize brand-new profile
        const newProfile: UserProfile = {
          userId: currentUser.uid,
          displayName: currentUser.displayName || 'Plot Twist Explorer',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || undefined,
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setError('Could not load user profile.');
      handleFirestoreError(err, OperationType.GET, path);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const saveUserProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('User not authenticated');
    const path = `users/${user.uid}`;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedData = {
        ...userProfile,
        ...updates,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userRef, updatedData, { merge: true });
      setUserProfile(updatedData as UserProfile);
      setError(null);
    } catch (err) {
      console.error('Failed to save profile:', err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const signIn = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('auth/unauthorized-domain')) {
        const msg = 'Domain not authorized in Firebase Console yet. To authorize: Go to Firebase Console -> Authentication -> Settings -> Authorized Domains and add this app URL.';
        setError(msg);
        console.warn(msg);
      } else {
        const msg = err instanceof Error ? err.message : 'Google Sign-in failed';
        setError(msg);
      }
      throw err;
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      await logoutUser();
      setUserProfile(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign out failed';
      setError(msg);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        error,
        signIn,
        signOut,
        refreshProfile,
        saveUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
