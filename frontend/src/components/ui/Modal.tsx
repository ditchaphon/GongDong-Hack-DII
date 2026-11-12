'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { Button } from './Button';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  onConfirm,
  confirmVariant = 'primary',
  isLoading = false,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClose}
        aria-label="ปิดหน้าต่าง"
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      {/* Dialog box */}
      <div
        className={clsx(
          'relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl z-10 flex flex-col gap-4 animate-scale-up',
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1 pr-6">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {description && (
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition -mr-2 -mt-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {children && <div className="py-1">{children}</div>}

        <div className="flex gap-2.5 pt-2">
          {cancelText && (
            <Button
              variant="outline"
              fullWidth
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelText}
            </Button>
          )}
          {onConfirm && (
            <Button
              variant={confirmVariant}
              fullWidth
              onClick={onConfirm}
              isLoading={isLoading}
            >
              {confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

