'use client';

import React from 'react';
import clsx from 'clsx';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock3,
  ShieldCheck,
} from 'lucide-react';
import { SlipCheckState } from '@/types/v4';
import { Button } from '@/components/ui/Button';

export interface SlipResultProps {
  state: Exclude<SlipCheckState, 'NONE'>;
  onRetry?: () => void;
  onContactAdmin?: () => void;
  className?: string;
}

const COPY = {
  CHECKING: {
    title: 'กำลังตรวจสลิป',
    description: 'ใช้เวลาประมาณ 10–30 วินาที · ไม่ต้องปิดหน้านี้',
    tone: 'bg-sky-50 border-sky-200 text-sky-900',
    icon: <Loader2 className="w-5 h-5 animate-spin text-sky-600" />,
  },
  PASSED: {
    title: 'ตรวจสลิปผ่าน',
    description: 'ยอดเงิน ชื่อผู้รับ และเลขสลิปถูกต้อง · ผู้ขายได้รับแจ้งแล้ว',
    tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
  },
  FAILED: {
    title: 'ตรวจสลิปไม่ผ่าน',
    description: 'ชื่อผู้รับ ยอดเงิน หรือเลขสลิปไม่ตรง · ตรวจแล้วแนบใหม่ได้เลย',
    tone: 'bg-rose-50 border-rose-200 text-rose-900',
    icon: <XCircle className="w-5 h-5 text-rose-600" />,
  },
  ADMIN_REVIEW: {
    title: 'ส่งให้แอดมินตรวจ',
    description: 'ระบบตรวจอัตโนมัติไม่สำเร็จ · แอดมินจะตรวจและแจ้งผลใน LINE',
    tone: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: <Clock3 className="w-5 h-5 text-amber-600" />,
  },
} as const;

export const SlipResult: React.FC<SlipResultProps> = ({
  state,
  onRetry,
  onContactAdmin,
  className,
}) => {
  const copy = COPY[state];

  return (
    <section
      className={clsx('rounded-2xl border p-4 space-y-2.5', copy.tone, className)}
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {copy.icon}
        <h3 className="text-sm font-bold">{copy.title}</h3>
      </div>
      <p className="text-[11px] leading-relaxed opacity-90">{copy.description}</p>

      {state === 'FAILED' && onRetry && (
        <Button size="sm" fullWidth onClick={onRetry}>
          แนบสลิปใหม่
        </Button>
      )}
      {state === 'ADMIN_REVIEW' && onContactAdmin && (
        <button
          type="button"
          onClick={onContactAdmin}
          className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] rounded-xl border border-amber-300 bg-white/70 text-[11px] font-semibold text-amber-900"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          ดูสถานะกับแอดมิน
        </button>
      )}
    </section>
  );
};
