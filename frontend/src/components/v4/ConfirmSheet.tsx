'use client';

import React from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';

export interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  isLoading?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}

/** v4 confirm step for money / irreversible actions. */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = 'ยกเลิก',
  tone = 'primary',
  isLoading = false,
  onConfirm,
  children,
}) => (
  <BottomSheet
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    footer={
      <div className="flex gap-2">
        <Button variant="outline" fullWidth onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          fullWidth
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmLabel}
        </Button>
      </div>
    }
  >
    <div className="space-y-3 py-1">
      {description && (
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  </BottomSheet>
);
