'use client';

import React from 'react';
import clsx from 'clsx';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  selected?: boolean;
  count?: number;
  icon?: React.ReactNode;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  count,
  icon,
  onRemove,
  size = 'md',
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-all select-none',
        'active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1',
        size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-sm px-3.5 py-1.5',
        selected
          ? 'bg-[#06C755] text-white focus:ring-[#06C755] shadow-xs'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 focus:ring-slate-300',
        disabled && 'opacity-40 pointer-events-none active:scale-100',
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={clsx(
            'inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 py-0.2',
            selected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
          )}
        >
          {count}
        </span>
      )}
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-75 inline-flex items-center"
        >
          ✕
        </span>
      )}
    </button>
  );
};

