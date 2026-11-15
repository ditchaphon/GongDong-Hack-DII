'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useLiff } from '@/hooks/useLiff';

export interface ProfileContextValue {
  nickname: string;
  avatar: string;
  consent: boolean;
  isComplete: boolean;
  loading: boolean;
  saveProfile: (data: {
    nickname: string;
    avatar: string;
    consent: boolean;
  }) => Promise<void>;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const consentKeyFor = (userId: string) => `gongdong.pdpa.consent.${userId}`;

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isReady, idToken, refreshUser } = useLiff();

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (!user.id) {
      setNickname('');
      setAvatar('');
      setConsent(false);
      return;
    }

    const backendNickname = user.nickname?.trim() ?? '';
    setNickname(backendNickname);
    setAvatar(user.pictureUrl || '');

    let storedConsent = false;
    try {
      storedConsent = window.localStorage.getItem(consentKeyFor(user.id)) === '1';
    } catch {
      storedConsent = false;
    }
    setConsent(Boolean(user.pdpaConsentAt) || storedConsent || backendNickname.length >= 2);
  }, [isReady, user.id, user.nickname, user.pictureUrl, user.pdpaConsentAt]);

  const saveProfile = async (data: {
    nickname: string;
    avatar: string;
    consent: boolean;
  }) => {
    const clean = data.nickname.trim();

    if (idToken) {
      await api.patch(
        '/api/users/me',
        {
          nickname: clean,
          avatar_url: data.avatar || undefined,
          ...(data.consent ? { pdpa_consent: true } : {}),
        },
        { token: idToken }
      );
      await refreshUser();
    }

    setNickname(clean);
    setAvatar(data.avatar);
    setConsent(data.consent);

    try {
      if (data.consent) {
        window.localStorage.setItem(consentKeyFor(user.id), '1');
      } else {
        window.localStorage.removeItem(consentKeyFor(user.id));
      }
    } catch {
      /* ignore storage errors */
    }
  };

  const clearProfile = () => {
    setNickname('');
    setAvatar('');
    setConsent(false);
    try {
      window.localStorage.removeItem(consentKeyFor(user.id));
    } catch {
      /* ignore */
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        nickname,
        avatar,
        consent,
        isComplete: nickname.trim().length >= 2 && consent,
        loading: !isReady,
        saveProfile,
        clearProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a <ProfileProvider>');
  return ctx;
}
