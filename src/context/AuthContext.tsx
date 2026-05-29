import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, handleRedirectResult } from '../lib/firebase';

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed:", user ? "logged in" : "logged out");
      setUser(user);
      setLoading(false);
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
