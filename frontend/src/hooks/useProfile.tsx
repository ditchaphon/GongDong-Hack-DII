'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * v4 identity: nickname + avatar replace the LINE name/photo everywhere.
 * Stored in memory for the prototype (server session in production).
 */
export interface ProfileContextValue {
  nickname: string;
  avatar: string;
  consent: boolean;
  isComplete: boolean;
  saveProfile: (data: { nickname: string; avatar: string; consent: boolean }) => void;
  clearProfile: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [consent, setConsent] = useState(false);

  const saveProfile = (data: { nickname: string; avatar: string; consent: boolean }) => {
    setNickname(data.nickname.trim());
    setAvatar(data.avatar);
    setConsent(data.consent);
  };

  const clearProfile = () => {
    setNickname('');
    setAvatar('');
    setConsent(false);
  };

  return (
    <ProfileContext.Provider
      value={{
        nickname,
        avatar,
        consent,
        isComplete: nickname.trim().length >= 2 && consent,
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
