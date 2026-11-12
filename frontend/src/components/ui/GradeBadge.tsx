'use client';

import React from 'react';
import clsx from 'clsx';
import { BookGrade } from '@/types';

export interface GradeBadgeProps {
  grade: BookGrade;
  showDescription?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const GRADE_CONFIG: Record<BookGrade, { label: string; title: string; styles: string; badgeBg: string }> = {
  A: {
    label: 'เกรด A',
    title: 'เหมือนใหม่',
    styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeBg: 'bg-emerald-600 text-white',
  },
  B: {
    label: 'เกรด B',
    title: 'สภาพดีมาก',
    styles: 'bg-sky-50 text-sky-700 border-sky-200',
    badgeBg: 'bg-sky-600 text-white',
  },
  C: {
    label: 'เกรด C',
    title: 'อ่านทั่วไป',
    styles: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeBg: 'bg-amber-600 text-white',
  },
  D: {
    label: 'เกรด D',
    title: 'เน้นอ่าน',
    styles: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeBg: 'bg-purple-600 text-white',
  },
};

export const GradeBadge: React.FC<GradeBadgeProps> = ({
  grade,
  showDescription = true,
  size = 'md',
  className,
}) => {
  const config = GRADE_CONFIG[grade] || GRADE_CONFIG['B'];

  if (size === 'sm') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 font-semibold border rounded-md text-[11px] px-1.5 py-0.5',
          config.styles,
          className
        )}
      >
        <span>{grade}</span>
        {showDescription && <span className="font-normal opacity-80">{config.title}</span>}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium border rounded-lg',
        size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs',
        config.styles,
        className
      )}
    >
      <span
        className={clsx(
          'font-bold rounded text-center inline-flex items-center justify-center',
          size === 'lg' ? 'w-5 h-5 text-xs' : 'w-4 h-4 text-[10px]',
          config.badgeBg
        )}
      >
        {grade}
      </span>
      <span>{config.title}</span>
    </span>
  );
};

