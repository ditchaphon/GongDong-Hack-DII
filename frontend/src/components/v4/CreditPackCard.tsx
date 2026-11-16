'use client';

import React from 'react';
import clsx from 'clsx';
import { Check, Sparkles } from 'lucide-react';
import { CreditPack } from '@/types/v4';

export interface CreditPackCardProps {
  pack: CreditPack;
  selected: boolean;
  onSelect: (packId: string) => void;
  className?: string;
}

export const CreditPackCard: React.FC<CreditPackCardProps> = ({
  pack,
  selected,
  onSelect,
  className,
}) => (
  <button
    type="button"
    onClick={() => onSelect(pack.id)}
    aria-pressed={selected}
    className={clsx(
      'relative w-full text-left p-4 rounded-2xl border bg-white transition',
      selected
        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
        : 'border-slate-200 hover:border-slate-300',
      className
    )}
  >
    {pack.isPopular && (
      <span className="absolute -top-2 right-3 inline-flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
        <Sparkles className="w-3 h-3" />
        คุ้มที่สุด
      </span>
    )}

    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
            selected
              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
              : 'border-slate-300 bg-white'
          )}
        >
          {selected && <Check className="w-3 h-3 stroke-[3]" />}
        </span>
        <div>
          <div className="text-sm font-bold text-slate-900">
            {pack.name} · {pack.credits} เครดิต
          </div>
          <div className="text-[11px] text-slate-500">{pack.note}</div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-black text-slate-900">฿{pack.price.toLocaleString('th-TH')}</div>
        <div className="text-[10px] text-slate-400">
          ฿{(pack.price / pack.credits).toFixed(1)} / ออเดอร์
        </div>
      </div>
    </div>
  </button>
);
