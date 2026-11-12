'use client';

import React from 'react';
import clsx from 'clsx';

export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle' | 'book-card' | 'order-card';
  width?: string;
  height?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className,
}) => {
  if (variant === 'book-card') {
    return (
      <div className={clsx('flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden p-3 gap-3', className)}>
        <div className="w-full aspect-[3/4] bg-slate-200 rounded-xl animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse" />
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div className="h-5 bg-slate-200 rounded w-16 animate-pulse" />
          <div className="h-3 bg-slate-100 rounded w-12 animate-pulse" />
        </div>
      </div>
    );
  }

  if (variant === 'order-card') {
    return (
      <div className={clsx('flex flex-col bg-white border border-slate-200 rounded-2xl p-4 gap-3', className)}>
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <div className="h-3 bg-slate-200 rounded w-24 animate-pulse" />
          <div className="h-5 bg-slate-200 rounded-full w-20 animate-pulse" />
        </div>
        <div className="flex gap-3 py-1">
          <div className="w-14 h-18 bg-slate-200 rounded-lg animate-pulse shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-slate-200 rounded w-4/5 animate-pulse" />
            <div className="h-3 bg-slate-100 rounded w-1/3 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-20 animate-pulse" />
          <div className="h-8 bg-slate-200 rounded-xl w-24 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-slate-200 animate-pulse',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-3.5 rounded w-full',
        variant === 'rect' && 'rounded-xl',
        className
      )}
      style={{ width, height }}
    />
  );
};

