import { useState, useEffect, useRef } from 'react';
import { PracticeTimerSession, PracticeTimerStatus, PracticeTimerPauseReason } from '../types';

const STORAGE_KEY = 'local_active_practice_timer';

export function usePracticeTimer() {
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
          parsed.pauseReason = 'pagehide'; // assuming refresh or leave
          
          // Calculate any time elapsed before unload if possible, but 
          // usually we don't count time while the app was closed.
          // The accumulatedSeconds is already saved at the moment of pausing.
          // Wait, if it didn't save right before close, we might lose a few seconds,
          // but we save to localStorage frequently or on visibilitychange.
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
          
          // Sync to session occasionally to prevent large data loss on crash
          // We can do this every 5-10 seconds, but doing it in state might trigger too many renders.
          // Just update local storage directly here if we want? 
          // Not strictly necessary since we listen to pagehide.
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
      handlePause('window-blur');
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
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
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

  return {
    session,
    currentSeconds,
    startSession,
    pauseSession,
    resumeSession,
    finishSession,
    clearSession,
    getFinalSeconds
  };
}
