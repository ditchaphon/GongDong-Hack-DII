'use client';

import React from 'react';
import clsx from 'clsx';
import { BookOpen } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className,
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 text-center select-none',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-2xs">
        {icon || <BookOpen className="w-8 h-8 text-slate-400" />}
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="mt-5"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
};

