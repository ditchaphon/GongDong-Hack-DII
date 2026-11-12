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
  // Start empty so server and client agree; the real value is set after mount.
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = targetDate
      ? new Date(targetDate).getTime()
      : Date.now() + initialSeconds * 1000;
    const tick = () =>
      setTimeLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetDate, initialSeconds]);

  useEffect(() => {
    if (timeLeft === 0) onExpire?.();
  }, [timeLeft, onExpire]);

  const remaining = timeLeft ?? 0;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const formattedTime =
    timeLeft === null
      ? '--:--:--'
      : `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (variant === 'badge') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
          remaining < 3600
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
        remaining < 3600
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : 'bg-amber-50/80 border-amber-200 text-amber-900',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Clock
          className={clsx(
            'w-4 h-4',
            remaining < 3600 ? 'text-rose-500' : 'text-amber-600'
          )}
        />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="font-mono text-sm font-bold tracking-wider">
        {formattedTime}
      </div>
    </div>
  );
};
