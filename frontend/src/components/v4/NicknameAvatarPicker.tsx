'use client';

import React from 'react';
import clsx from 'clsx';
import { Check, UserRound, ShieldCheck } from 'lucide-react';

export interface NicknameAvatarPickerProps {
  nickname: string;
  onNicknameChange: (value: string) => void;
  avatar: string;
  onAvatarChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  error?: string;
  className?: string;
}

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120',
];

/**
 * v4 identity: nickname + avatar replace the LINE name/photo everywhere.
 * PDPA consent is required before saving.
 */
export const NicknameAvatarPicker: React.FC<NicknameAvatarPickerProps> = ({
  nickname,
  onNicknameChange,
  avatar,
  onAvatarChange,
  consent,
  onConsentChange,
  error,
  className,
}) => (
  <div className={clsx('space-y-4', className)}>
    <div className="flex flex-col gap-1.5">
      <label htmlFor="nickname" className="text-xs font-semibold text-slate-700">
        ชื่อที่แสดงในกองดอง
      </label>
      <div className="relative">
        <UserRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          id="nickname"
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          maxLength={24}
          placeholder="เช่น สกายอ่านหนังสือ"
          className="w-full min-h-[44px] pl-10 pr-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>
      <p className="text-[11px] text-slate-400">
        ใช้ชื่อเล่นได้ · ห้ามใส่เบอร์โทร ไลน์ หรือชื่อจริง · {nickname.length}/24
      </p>
    </div>

    <div>
      <span className="text-xs font-semibold text-slate-700">รูปโปรไฟล์</span>
      <div className="grid grid-cols-6 gap-2 mt-2">
        {AVATARS.map((url) => {
          const selected = avatar === url;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onAvatarChange(url)}
              aria-pressed={selected}
              aria-label="เลือกรูปโปรไฟล์"
              className={clsx(
                'relative aspect-square rounded-full overflow-hidden border-2',
                selected ? 'border-[var(--color-primary)]' : 'border-transparent'
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {selected && (
                <span className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>

    <button
      type="button"
      onClick={() => onConsentChange(!consent)}
      className="w-full flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white text-left"
    >
      <span
        className={clsx(
          'mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
          consent
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
            : 'bg-white border-slate-300'
        )}
      >
        {consent && <Check className="w-3.5 h-3.5 stroke-[3]" />}
      </span>
      <span className="text-[11px] text-slate-600 leading-relaxed">
        ยินยอมให้เก็บชื่อเล่น รูปโปรไฟล์ และประวัติการซื้อขาย เพื่อใช้งานกองดอง
        ตามนโยบาย PDPA · ถอนความยินยอมได้ภายหลัง
      </span>
    </button>

    {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}

    <p className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
      <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      ชื่อและรูปจาก LINE จะไม่ถูกแสดงให้ผู้ใช้อื่นเห็น
    </p>
  </div>
);
