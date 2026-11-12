'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxHeight = 'max-h-[85vh]',
  className,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClose}
        aria-label="ปิดหน้าต่าง"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
      />

      {/* Sheet Container */}
      <div
        className={clsx(
          'relative w-full max-w-[430px] bg-white rounded-t-3xl shadow-sheet z-10 flex flex-col overflow-hidden animate-slide-up',
          maxHeight,
          className
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-base">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 overscroll-contain">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 safe-area-bottom">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

