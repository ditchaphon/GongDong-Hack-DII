'use client';

import React from 'react';
import { MessageCirclePlus, ExternalLink } from 'lucide-react';
import { useLiff } from '@/hooks/useLiff';

export interface LineOaBannerProps {
  className?: string;
}

export const LineOaBanner: React.FC<LineOaBannerProps> = ({ className = '' }) => {
  const { isReady, isMock, friendship, openWindow } = useLiff();
  const rawOaId = (process.env.NEXT_PUBLIC_LINE_OA_ID || '').trim().replace(/^@/, '');

  if (!isReady || isMock || friendship) {
    return null;
  }

  const addFriendUrl = rawOaId ? `https://line.me/R/ti/p/@${rawOaId}` : null;

  return (
    <div
      className={`rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-950 flex items-start justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
          <MessageCirclePlus className="w-4 h-4" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="font-bold text-emerald-950 leading-snug">
            เพิ่มเพื่อน LINE OA เพื่อรับแจ้งเตือนออเดอร์
          </p>
          <p className="text-[11px] text-emerald-800 leading-relaxed">
            รับการ์ดแจ้งเตือนสถานะคำสั่งซื้อ เวลานัดรับ และข้อความแชททาง LINE แม้ปิดหน้านี้ไปแล้ว
          </p>
        </div>
      </div>

      {addFriendUrl && (
        <button
          type="button"
          onClick={() => openWindow(addFriendUrl, false)}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-2xs"
        >
          <span>แอดเพื่อน</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
