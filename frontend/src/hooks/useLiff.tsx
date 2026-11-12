'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { UserProfile } from '@/types';

export interface LiffContextValue {
  isReady: boolean;
  isInClient: boolean;
  isLoggedIn: boolean;
  isMock: boolean;
  liffVersion: string;
  os: string;
  language: string;
  idToken: string | null;
  user: UserProfile;
  friendship: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  openWindow: (url: string, external?: boolean) => void;
  closeWindow: () => void;
  scanCode: () => Promise<string | null>;
  shareTargetPicker: (messages: any[]) => Promise<boolean>;
  deductCredit: (amount?: number) => boolean;
  addCredits: (amount: number) => void;
}

const MOCK_USER: UserProfile = {
  id: 'usr_mock_01',
  lineUserId: 'U1234567890abcdef',
  displayName: 'Sky Cautious',
  pictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  isSeller: true,
  credits: 5,
  isVerifiedSeller: true,
};

const LiffContext = createContext<LiffContextValue | null>(null);

export const LiffProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const isMockEnv =
    process.env.NEXT_PUBLIC_LIFF_MOCK === 'true' ||
    !process.env.NEXT_PUBLIC_LIFF_ID ||
    process.env.NEXT_PUBLIC_LIFF_ID === 'mock-liff-id';

  const [isReady, setIsReady] = useState<boolean>(false);
  const [isInClient, setIsInClient] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(isMockEnv);
  const [liffVersion, setLiffVersion] = useState<string>('mock-2.22.0');
  const [os, setOs] = useState<string>('web');
  const [language, setLanguage] = useState<string>('th');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(MOCK_USER);
  const [friendship, setFriendship] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initLiff() {
      // 1. Mock Mode (Development or Forced Mock)
      if (isMockEnv) {
        if (mounted) {
          setIsInClient(false);
          setIsLoggedIn(true);
          setIsMock(true);
          setIdToken('mock_id_token_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
          setIsReady(true);
        }
        return;
      }

      // 2. Real LIFF SDK Initialization
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;

        await liff.init({
          liffId: process.env.NEXT_PUBLIC_LIFF_ID as string,
        });

        if (!mounted) return;

        const inClient = liff.isInClient();
        const loggedIn = liff.isLoggedIn();
        const clientOs = liff.getOS() || 'web';
        const clientLang = liff.getLanguage() || 'th';
        const version = liff.getVersion();

        setIsInClient(inClient);
        setIsLoggedIn(loggedIn);
        setOs(clientOs);
        setLanguage(clientLang);
        setLiffVersion(version);

        if (loggedIn) {
          const profile = await liff.getProfile();
          const rawToken = liff.getIDToken();
          setIdToken(rawToken);

          // Check friendship with LINE OA
          try {
            const friendStatus = await liff.getFriendship();
            setFriendship(friendStatus.friendFlag);
          } catch {
            setFriendship(true);
          }

          setUser((prev) => ({
            ...prev,
            lineUserId: profile.userId,
            displayName: profile.displayName || prev.displayName,
            pictureUrl: profile.pictureUrl || prev.pictureUrl,
          }));
        }

        setIsReady(true);
      } catch (err: any) {
        console.error('LIFF init error:', err);
        if (mounted) {
          setError(err?.message || 'Failed to initialize LIFF');
          // Graceful fallback to mock mode if LIFF init fails
          setIsMock(true);
          setIsLoggedIn(true);
          setIsReady(true);
        }
      }
    }

    initLiff();

    return () => {
      mounted = false;
    };
  }, [isMockEnv]);

  const login = useCallback(async () => {
    if (isMock) {
      setIsLoggedIn(true);
      return;
    }
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      if (!liff.isLoggedIn()) {
        liff.login();
      }
    } catch (err) {
      console.error('LIFF login failed:', err);
    }
  }, [isMock]);

  const logout = useCallback(async () => {
    if (isMock) {
      setIsLoggedIn(false);
      return;
    }
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      if (liff.isLoggedIn()) {
        liff.logout();
        setIsLoggedIn(false);
      }
    } catch (err) {
      console.error('LIFF logout failed:', err);
    }
  }, [isMock]);

  const openWindow = useCallback(
    async (url: string, external: boolean = true) => {
      if (isMock || !isInClient) {
        window.open(url, external ? '_blank' : '_self');
        return;
      }
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;
        liff.openWindow({ url, external });
      } catch {
        window.open(url, '_blank');
      }
    },
    [isMock, isInClient]
  );

  const closeWindow = useCallback(async () => {
    if (isMock || !isInClient) {
      window.history.back();
      return;
    }
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      liff.closeWindow();
    } catch {
      window.history.back();
    }
  }, [isMock, isInClient]);

  const scanCode = useCallback(async (): Promise<string | null> => {
    if (isMock || !isInClient) {
      // In mock/external browser, prompt fallback
      return null;
    }
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      if (liff.scanCodeV2) {
        const result = await liff.scanCodeV2();
        return result.value || null;
      }
    } catch (err) {
      console.warn('scanCodeV2 error or permission denied:', err);
    }
    return null;
  }, [isMock, isInClient]);

  const shareTargetPicker = useCallback(
    async (messages: any[]): Promise<boolean> => {
      if (isMock || !isInClient) {
        return false;
      }
      try {
        const liffModule = await import('@line/liff');
        const liff = liffModule.default;
        if (liff.isApiAvailable('shareTargetPicker')) {
          const res = await liff.shareTargetPicker(messages);
          return !!res;
        }
      } catch (err) {
        console.warn('shareTargetPicker failed:', err);
      }
      return false;
    },
    [isMock, isInClient]
  );

  const deductCredit = useCallback(
    (amount: number = 1): boolean => {
      if (user.credits < amount) return false;
      setUser((prev) => ({ ...prev, credits: prev.credits - amount }));
      return true;
    },
    [user.credits]
  );

  const addCredits = useCallback((amount: number) => {
    setUser((prev) => ({ ...prev, credits: prev.credits + amount }));
  }, []);

  return (
    <LiffContext.Provider
      value={{
        isReady,
        isInClient,
        isLoggedIn,
        isMock,
        liffVersion,
        os,
        language,
        idToken,
        user,
        friendship,
        error,
        login,
        logout,
        openWindow,
        closeWindow,
        scanCode,
        shareTargetPicker,
        deductCredit,
        addCredits,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
};

export function useLiff(): LiffContextValue {
  const context = useContext(LiffContext);
  if (!context) {
    throw new Error('useLiff must be used within a <LiffProvider>');
  }
  return context;
}

