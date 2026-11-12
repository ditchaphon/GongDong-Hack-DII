'use client';

import React, { useRef } from 'react';
import clsx from 'clsx';
import { AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  onSubmit?: () => void;
  isLoading?: boolean;
  error?: string;
  attemptsLeft?: number;
  expiresLabel?: string;
  disabled?: boolean;
  className?: string;
}

const LENGTH = 6;

/** Seller-side input for the buyer's 6-digit handover code. */
export const CodeInput: React.FC<CodeInputProps> = ({
  value,
  onChange,
  onComplete,
  onSubmit,
  isLoading = false,
  error,
  attemptsLeft,
  expiresLabel,
  disabled = false,
  className,
}) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (index: number, digit: string) => {
    const clean = digit.replace(/\D/g, '').slice(-1);
    const next = value.padEnd(LENGTH, ' ').split('');
    next[index] = clean || ' ';
    const joined = next.join('').replace(/\s+$/g, '');
    onChange(joined.replace(/\s/g, ''));
    if (clean && index < LENGTH - 1) refs.current[index + 1]?.focus();
    if (clean && index === LENGTH - 1 && joined.replace(/\s/g, '').length === LENGTH) {
      onComplete?.(joined.replace(/\s/g, ''));
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, LENGTH - 1)]?.focus();
    if (pasted.length === LENGTH) onComplete?.(pasted);
  };

  const digits = value.padEnd(LENGTH, ' ').split('');

  return (
    <div className={clsx('space-y-3', className)}>
      <div>
        <label className="text-xs font-semibold text-slate-700">
          รหัสรับของ 6 หลัก
        </label>
        <div className="flex justify-center gap-2 mt-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                refs.current[index] = element;
              }}
              value={digit.trim()}
              onChange={(event) => setDigit(index, event.target.value)}
              onPaste={handlePaste}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !digit.trim() && index > 0) {
                  refs.current[index - 1]?.focus();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              disabled={disabled}
              aria-label={`หลักที่ ${index + 1}`}
              className={clsx(
                'w-11 h-14 text-center text-2xl font-black rounded-xl border focus:outline-none focus:ring-2',
                error
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                  : 'border-slate-200 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20 text-slate-900',
                disabled && 'bg-slate-50 text-slate-400'
              )}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="flex items-start justify-center gap-1 text-[11px] text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      {typeof attemptsLeft === 'number' && !error && (
        <p className="text-center text-[10px] text-slate-400">
          กรอกผิดได้อีก {attemptsLeft} ครั้ง
        </p>
      )}

      {expiresLabel && (
        <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-3 h-3" />
          {expiresLabel}
        </p>
      )}

      {onSubmit && (
        <Button
          fullWidth
          size="lg"
          onClick={onSubmit}
          isLoading={isLoading}
          disabled={disabled || value.replace(/\D/g, '').length !== LENGTH}
        >
          ยืนยันรหัสและปิดออเดอร์
        </Button>
      )}
    </div>
  );
};
