'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

/**
 * One LINE account, two hats. Buyers browse with zero setup; seller mode
 * swaps the bottom navigation to shop tools. Remembered per device only.
 */
export type AppMode = 'BUYER' | 'SELLER';

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const STORAGE_KEY = 'gongdong.mode';

const AppModeContext = createContext<AppModeContextValue | null>(null);

export const AppModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<AppMode>('BUYER');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'BUYER' || saved === 'SELLER') setModeState(saved);
    } catch {
      /* storage blocked: default to buyer */
    }
  }, []);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>{children}</AppModeContext.Provider>
  );
};

export function useAppMode(): AppModeContextValue {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error('useAppMode must be used within an <AppModeProvider>');
  return ctx;
}
