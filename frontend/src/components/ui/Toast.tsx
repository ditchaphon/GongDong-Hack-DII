'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error' | 'warning';

export interface ToastProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  type?: ToastType;
  durationMs?: number;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  isOpen,
  onClose,
  message,
  type = 'success',
  durationMs = 3000,
  className,
}) => {
  useEffect(() => {
    if (isOpen && durationMs > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
  };

  return (
    <aside
      aria-label="การแจ้งเตือน"
      className="fixed top-5 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div
        className={clsx(
          'pointer-events-auto flex items-center gap-3 px-4 py-3 bg-slate-900/90 text-white rounded-2xl shadow-lg backdrop-blur-md max-w-sm w-full animate-slide-down',
          className
        )}
      >
        {icons[type]}
        <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดแจ้งเตือน"
          className="text-slate-400 hover:text-white p-1 rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

