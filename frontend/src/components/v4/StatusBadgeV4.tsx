'use client';

import React from 'react';
import clsx from 'clsx';
import { V4OrderStatus } from '@/types/v4';
import { STATUS_META, StatusTone } from '@/lib/orderStateMachine';

export interface StatusBadgeV4Props {
  status: V4OrderStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const TONE_CLASS: Record<StatusTone, { chip: string; dot: string }> = {
  amber: { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  blue: { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  teal: { chip: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rose: { chip: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  slate: { chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  violet: { chip: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
};

export const StatusBadgeV4: React.FC<StatusBadgeV4Props> = ({
  status,
  size = 'md',
  className,
}) => {
  const meta = STATUS_META[status];
  const tone = TONE_CLASS[meta.tone];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium border rounded-full select-none',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        tone.chip,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', tone.dot)} />
      <span>{meta.label}</span>
    </span>
  );
};
