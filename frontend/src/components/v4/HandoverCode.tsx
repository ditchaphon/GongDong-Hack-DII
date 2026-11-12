'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { Eye, EyeOff, ShieldAlert, WifiOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface HandoverCodeProps {
  code: string;
  verified?: boolean;
  onReveal?: () => void;
  className?: string;
}

/**
 * Buyer-only screen. The seller must never receive this code before the
 * handover, and the buyer must only show it after inspecting and paying.
 */
export const HandoverCode: React.FC<HandoverCodeProps> = ({
  code,
  verified = false,
  onReveal,
  className,
}) => {
  const [revealed, setRevealed] = useState(false);

  const reveal = () => {
    setRevealed(true);
    onReveal?.();
  };

  return (
    <section
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white p-5 text-center space-y-4',
        className
      )}
      aria-label="รหัสรับของ"
    >
      <div>
        <h3 className="text-sm font-bold text-slate-900">รหัสรับของ</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">
          บอกรหัสนี้กับผู้ขายหลังตรวจหนังสือและจ่ายเงินแล้วเท่านั้น
        </p>
      </div>

      {verified ? (
        <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold">
          <Check className="w-5 h-5" />
          ผู้ขายยืนยันรหัสแล้ว · ปิดออเดอร์สำเร็จ
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-2" aria-live="polite">
            {code.split('').map((digit, index) => (
              <span
                key={index}
                className={clsx(
                  'w-11 h-14 rounded-xl border flex items-center justify-center text-2xl font-black',
                  revealed
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-300'
                )}
              >
                {revealed ? digit : '•'}
              </span>
            ))}
          </div>

          {!revealed && (
            <Button
              fullWidth
              size="lg"
              onClick={reveal}
              leftIcon={<Eye className="w-4 h-4" />}
            >
              แตะเพื่อดูรหัส
            </Button>
          )}

          {revealed && (
            <button
              type="button"
              onClick={() => setRevealed(false)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"
            >
              <EyeOff className="w-3.5 h-3.5" />
              ซ่อนรหัสอีกครั้ง
            </button>
          )}
        </>
      )}

      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 text-left leading-relaxed">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          ห้ามบอกรหัสก่อนได้รับหนังสือ · ถ้าผู้ขายขอรหัสทางแชทก่อนเจอ ให้แจ้งปัญหา
        </span>
      </div>

      <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
        <WifiOff className="w-3 h-3" />
        รหัสถูกเก็บไว้ในเครื่องคุณ เปิดดูได้แม้เน็ตหลุด
      </p>
    </section>
  );
};
