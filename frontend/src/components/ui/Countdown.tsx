'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { Clock } from 'lucide-react';

export interface CountdownProps {
  initialSeconds?: number;
  targetDate?: string | Date;
  onExpire?: () => void;
  label?: string;
  variant?: 'standard' | 'badge' | 'danger';
  className?: string;
}

export const Countdown: React.FC<CountdownProps> = ({
  initialSeconds = 48 * 3600, // Default to 48-hour SLA
  targetDate,
  onExpire,
  label = 'เวลาที่เหลือ:',
  variant = 'standard',
  className,
}) => {
  const calculateRemaining = (): number => {
    if (targetDate) {
      const diff = Math.floor((new Date(targetDate).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return initialSeconds;
  };

  const [timeLeft, setTimeLeft] = useState<number>(calculateRemaining);

  useEffect(() => {
    if (timeLeft <= 0) {
      onExpire?.();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onExpire]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (variant === 'badge') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
          timeLeft < 3600
            ? 'bg-rose-50 text-rose-600 border border-rose-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200',
          className
        )}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{formattedTime}</span>
      </span>
    );
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-3 rounded-2xl border select-none',
        timeLeft < 3600
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : 'bg-amber-50/80 border-amber-200 text-amber-900',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={clsx('w-4 h-4', timeLeft < 3600 ? 'text-rose-500' : 'text-amber-600')} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="font-mono text-sm font-bold tracking-wider">
        {formattedTime}
      </div>
    </div>
  );
};

