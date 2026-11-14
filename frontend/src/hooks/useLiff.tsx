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
import { api, setApiAuthToken } from '@/lib/api';

interface BackendUserProfile {
  id: string;
  line_user_id: string;
  display_name: string | null;
  picture_url: string | null;
  nickname: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  verified_name: string | null;
  promptpay_id: string | null;
  is_verified_seller: boolean;
  pdpa_consent_at?: string | null;
  no_show_count: number;
  credits: number;
}

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
  refreshUser: () => Promise<void>;
  openWindow: (url: string, external?: boolean) => void;
  closeWindow: () => void;
  scanCode: () => Promise<string | null>;
  shareTargetPicker: (messages: any[]) => Promise<boolean>;
  deductCredit: (amount?: number) => boolean;
  addCredits: (amount: number) => void;
}

const EMPTY_USER: UserProfile = {
  id: '',
  lineUserId: '',
  displayName: 'ผู้ใช้งาน',
  isSeller: false,
  credits: 0,
  isVerifiedSeller: false,
};

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
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_LIFF_MOCK === 'true' ||
      !process.env.NEXT_PUBLIC_LIFF_ID ||
      process.env.NEXT_PUBLIC_LIFF_ID === 'mock-liff-id');

  const [isReady, setIsReady] = useState<boolean>(false);
  const [isInClient, setIsInClient] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isMock, setIsMock] = useState<boolean>(isMockEnv);
  const [liffVersion, setLiffVersion] = useState<string>('mock-2.22.0');
  const [os, setOs] = useState<string>('web');
  const [language, setLanguage] = useState<string>('th');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [friendship, setFriendship] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syncUserWithBackend = useCallback(
    async (token: string, liffProfileFallback?: Partial<UserProfile>) => {
      const profile = await api.get<BackendUserProfile>('/api/users/me', { token });
      setUser({
        id: profile.id,
        lineUserId: profile.line_user_id,
        displayName:
          profile.nickname ||
          profile.display_name ||
          liffProfileFallback?.displayName ||
          'ผู้ใช้กองดอง',
        nickname: profile.nickname || undefined,
        pictureUrl:
          profile.avatar_url ||
          profile.picture_url ||
          liffProfileFallback?.pictureUrl,
        isSeller: true,
        credits: profile.credits,
        isVerifiedSeller: profile.is_verified_seller,
        pdpaConsentAt: profile.pdpa_consent_at ?? null,
        promptPayName: profile.verified_name || undefined,
        phone: profile.phone_number || undefined,
      });
    },
    []
  );

  const refreshUser = useCallback(async () => {
    if (!idToken) return;
    try {
      await syncUserWithBackend(idToken);
    } catch (err) {
      console.warn('[useLiff] Failed to refresh user profile from backend:', err);
    }
  }, [idToken, syncUserWithBackend]);

  useEffect(() => {
    let mounted = true;

    async function initLiff() {
      // 1. Mock Mode (Development only when NEXT_PUBLIC_LIFF_MOCK=true or no LIFF ID)
      if (isMockEnv) {
        const mockToken = 'mock_usr_mock_01';
        setApiAuthToken(mockToken);
        if (mounted) {
          setIsInClient(false);
          setIsLoggedIn(true);
          setIsMock(true);
          setIdToken(mockToken);
        }
        try {
          await syncUserWithBackend(mockToken);
        } catch (err) {
          console.warn('[useLiff] Backend /api/users/me unreachable in mock mode, using offline MOCK_USER:', err);
          if (mounted) {
            setUser(MOCK_USER);
          }
        } finally {
          if (mounted) {
            setIsReady(true);
          }
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

        // Outside the LINE app the user may not be logged in yet: redirect to
        // LINE Login once. The sessionStorage guard + ?error= check stop a loop
        // when the user cancels the consent screen.
        if (!loggedIn) {
          const params = new URLSearchParams(window.location.search);
          let tried = false;
          try {
            tried = sessionStorage.getItem('gongdong.liffLoginTried') === '1';
            if (!tried && !params.get('error')) sessionStorage.setItem('gongdong.liffLoginTried', '1');
          } catch {
            /* storage blocked */
          }
          if (!tried && !params.get('error')) {
            liff.login({ redirectUri: window.location.href });
            return;
          }
        } else {
          try {
            sessionStorage.removeItem('gongdong.liffLoginTried');
          } catch {
            /* ignore */
          }
        }

        if (loggedIn) {
          const profile = await liff.getProfile();
          const rawToken = liff.getIDToken();
          setApiAuthToken(rawToken);
          setIdToken(rawToken);

          // Check friendship with LINE OA
          try {
            const friendStatus = await liff.getFriendship();
            setFriendship(friendStatus.friendFlag);
          } catch {
            setFriendship(true);
          }

          if (rawToken) {
            try {
              await syncUserWithBackend(rawToken, {
                displayName: profile.displayName,
                pictureUrl: profile.pictureUrl,
              });
            } catch (syncErr: any) {
              console.error('[useLiff] Failed to sync user with backend:', syncErr);
              if (mounted) {
                setUser(EMPTY_USER);
                setError(syncErr?.message || 'ไม่สามารถเชื่อมต่อข้อมูลผู้ใช้จากเซิร์ฟเวอร์ได้');
              }
            }
          } else {
            setUser({
              ...EMPTY_USER,
              lineUserId: profile.userId,
              displayName: profile.displayName || EMPTY_USER.displayName,
              pictureUrl: profile.pictureUrl,
            });
          }
        }

        if (mounted) {
          setIsReady(true);
        }
      } catch (err: any) {
        console.error('LIFF init error:', err);
        if (mounted) {
          setUser(EMPTY_USER);
          setError(err?.message || 'ไม่สามารถเชื่อมต่อ LINE LIFF ได้');
          setIsLoggedIn(false);
          setIsReady(true);
        }
      }
    }

    initLiff();

    return () => {
      mounted = false;
    };
  }, [isMockEnv, syncUserWithBackend]);

  const login = useCallback(async () => {
    if (isMock) {
      const mockToken = 'mock_usr_mock_01';
      setApiAuthToken(mockToken);
      setIdToken(mockToken);
      setIsLoggedIn(true);
      setError(null);
      try {
        await syncUserWithBackend(mockToken);
      } catch {
        setUser(MOCK_USER);
      }
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
  }, [isMock, syncUserWithBackend]);

  const logout = useCallback(async () => {
    setApiAuthToken(null);
    setIdToken(null);
    setUser(EMPTY_USER);
    setError(null);
    if (isMock) {
      setIsLoggedIn(false);
      return;
    }
    try {
      const liffModule = await import('@line/liff');
      const liff = liffModule.default;
      if (liff.isLoggedIn()) {
        liff.logout();
      }
      setIsLoggedIn(false);
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
        refreshUser,
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

