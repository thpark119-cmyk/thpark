import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseReady, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: any;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, error: null });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!isFirebaseReady || !auth) {
      console.log("Firebase Auth is inactive. Defaulting immediately to local state mode.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("Auth state changed:", currentUser ? "logged in" : "logged out");
      setUser(currentUser);
      setLoading(false);

      if (currentUser && db) {
        try {
          // Create or update the root profile document so the user list and dashboard calculations work reliably
          await setDoc(
            doc(db, 'users', currentUser.uid),
            {
              uid: currentUser.uid,
              email: currentUser.email ?? '',
              displayName: currentUser.displayName ?? '',
              photoURL: currentUser.photoURL ?? '',
              lastSeenAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (err) {
          // Do not log any personal identifiers in console
          console.warn("Failed to update user profile document on auth state change.");
        }
      }
    }, (err) => {
      console.error("Auth state error:", err);
      setError(err);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

