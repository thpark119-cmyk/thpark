import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PracticeTimerSession, PracticeTimerStatus, PracticeTimerPauseReason } from '../types';

const STORAGE_KEY = 'local_active_practice_timer';

interface PracticeTimerContextType {
  session: PracticeTimerSession | null;
  currentSeconds: number;
  startSession: (details: Partial<PracticeTimerSession>) => void;
  pauseSession: (reason?: PracticeTimerPauseReason) => void;
  resumeSession: () => void;
  finishSession: () => number;
  clearSession: () => void;
  getFinalSeconds: () => number;
}

const PracticeTimerContext = createContext<PracticeTimerContextType | null>(null);

export function PracticeTimerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PracticeTimerSession | null>(null);
  const [currentSeconds, setCurrentSeconds] = useState(0);

  // Load initial state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PracticeTimerSession;
        // If it was running during a reload, change it to paused
        if (parsed.status === 'running') {
          parsed.status = 'paused';
          parsed.pauseReason = 'refresh'; 
        }
        setSession(parsed);
        setCurrentSeconds(parsed.accumulatedSeconds);
      }
    } catch (err) {
      console.error('Failed to load timer session:', err);
    }
  }, []);

  // Save to localStorage whenever session changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // Timer interval & update current seconds
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (session && session.status === 'running') {
      intervalId = setInterval(() => {
        if (session.lastResumedAt) {
          const now = Date.now();
          const elapsedSinceResume = Math.floor((now - session.lastResumedAt) / 1000);
          setCurrentSeconds(session.accumulatedSeconds + elapsedSinceResume);
        }
      }, 1000);
    } else if (session && session.status === 'paused') {
      setCurrentSeconds(session.accumulatedSeconds);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session]);

  // Handle visibility change and window events
  useEffect(() => {
    let blurTimeout: NodeJS.Timeout;
    
    const handlePause = (reason: PracticeTimerPauseReason) => {
      setSession(prev => {
        if (!prev || prev.status !== 'running' || !prev.lastResumedAt) return prev;
        
        const now = Date.now();
        const elapsedSinceResume = Math.floor((now - prev.lastResumedAt) / 1000);
        const newAccumulated = prev.accumulatedSeconds + elapsedSinceResume;

        return {
          ...prev,
          status: 'paused',
          accumulatedSeconds: newAccumulated,
          pauseReason: reason
        };
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handlePause('app-hidden');
      }
    };

    const handleWindowBlur = () => {
      // Don't pause immediately to allow internal app navigation to not trigger a pause
      blurTimeout = setTimeout(() => {
        if (document.visibilityState === 'hidden') {
           handlePause('window-blur');
        }
      }, 500); // short debounce
    };
    
    const handleWindowFocus = () => {
      if (blurTimeout) {
         clearTimeout(blurTimeout);
      }
    };
    
    const handlePageHide = () => {
      handlePause('pagehide');
      // Force sync to local storage immediately
      setSession(prev => {
        if (prev) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        }
        return prev;
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pagehide', handlePageHide);
      if (blurTimeout) clearTimeout(blurTimeout);
    };
  }, []);

  const startSession = (details: Partial<PracticeTimerSession>) => {
    const newSession: PracticeTimerSession = {
      id: crypto.randomUUID(),
      status: 'running',
      startedAt: Date.now(),
      lastResumedAt: Date.now(),
      accumulatedSeconds: 0,
      ...details
    };
    setSession(newSession);
    setCurrentSeconds(0);
  };

  const pauseSession = (reason: PracticeTimerPauseReason = 'manual') => {
    setSession(prev => {
      if (!prev || prev.status !== 'running' || !prev.lastResumedAt) return prev;
      
      const now = Date.now();
      const elapsedSinceResume = Math.floor((now - prev.lastResumedAt) / 1000);
      
      return {
        ...prev,
        status: 'paused',
        accumulatedSeconds: prev.accumulatedSeconds + elapsedSinceResume,
        pauseReason: reason
      };
    });
  };

  const resumeSession = () => {
    setSession(prev => {
      if (!prev || prev.status === 'running') return prev;
      return {
        ...prev,
        status: 'running',
        lastResumedAt: Date.now(),
        pauseReason: undefined
      };
    });
  };

  const finishSession = () => {
    let finalSeconds = 0;
    
    setSession(prev => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'finished'
      };
    });
    
    if (session) {
      if (session.status === 'running' && session.lastResumedAt) {
        const now = Date.now();
        const elapsedSinceResume = Math.floor((now - session.lastResumedAt) / 1000);
        finalSeconds = session.accumulatedSeconds + elapsedSinceResume;
      } else {
        finalSeconds = session.accumulatedSeconds;
      }
    }
    
    return finalSeconds;
  };
  
  const getFinalSeconds = () => {
    if (!session) return 0;
    if (session.status === 'running' && session.lastResumedAt) {
        const now = Date.now();
        return session.accumulatedSeconds + Math.floor((now - session.lastResumedAt) / 1000);
    }
    return session.accumulatedSeconds;
  };

  const clearSession = () => {
    setSession(null);
    setCurrentSeconds(0);
  };

  return (
    <PracticeTimerContext.Provider
      value={{
        session,
        currentSeconds,
        startSession,
        pauseSession,
        resumeSession,
        finishSession,
        clearSession,
        getFinalSeconds
      }}
    >
      {children}
    </PracticeTimerContext.Provider>
  );
}

export function usePracticeTimer() {
  const context = useContext(PracticeTimerContext);
  if (!context) {
    throw new Error('usePracticeTimer must be used within a PracticeTimerProvider');
  }
  return context;
}
