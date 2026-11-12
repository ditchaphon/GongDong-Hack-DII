'use client';

import React from 'react';
import clsx from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface TopBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightAction,
  transparent = false,
  className,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header
      className={clsx(
        'sticky top-0 z-30 flex items-center justify-between min-h-[52px] px-4 select-none transition-colors',
        transparent ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs',
        className
      )}
    >
      <div className="flex items-center min-w-[44px]">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="ย้อนกลับ"
            className="flex items-center justify-center w-10 h-10 -ml-2 text-slate-700 hover:text-slate-900 active:scale-95 rounded-full hover:bg-slate-100 transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-2" />
        )}
      </div>

      <div className="flex-1 text-center truncate px-2">
        {title && (
          <h1 className="text-base font-bold text-slate-900 truncate leading-snug">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center justify-end min-w-[44px]">
        {rightAction || <div className="w-2" />}
      </div>
    </header>
  );
};

