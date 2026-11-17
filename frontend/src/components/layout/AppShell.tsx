'use client';

import React from 'react';
import { useLiff } from '@/hooks/useLiff';
import { InAppNotificationBanner } from '@/components/v4';
import { ExternalLink } from 'lucide-react';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { isInClient, isMock, isReady } = useLiff();

  // Basic ID is configured without "@" (e.g. 848xkfsj); the URL needs the "@".
  const oaId = process.env.NEXT_PUBLIC_LINE_OA_ID || 'gongdong';
  const oaHandle = oaId.startsWith('@') ? oaId : `@${oaId}`;

  return (
    <div className="w-full max-w-[430px] min-h-screen bg-white shadow-sm flex flex-col relative mx-auto">
      <InAppNotificationBanner />

      {/* External Browser Banner (Show only when in real mode outside LINE) */}
      {!isMock && !isInClient && isReady && (
        <div className="bg-amber-500 text-white px-3 py-2 text-xs flex items-center justify-between shadow-xs sticky top-0 z-40">
          <span className="truncate">คุณกำลังเปิดผ่านเบราว์เซอร์ภายนอก</span>
          <a
            href={`https://line.me/R/ti/p/${oaHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-bold underline shrink-0 ml-2"
          >
            เปิดใน LINE <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
};

