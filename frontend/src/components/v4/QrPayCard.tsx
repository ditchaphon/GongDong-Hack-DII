'use client';

import React from 'react';
import clsx from 'clsx';
import { QrCode, ShieldAlert, ExternalLink, Loader2 } from 'lucide-react';
import { buildQrCells, finderOrigins, formatTHB, isFinderArea, QR_SIZE } from '@/lib/qr';

export interface QrPayCardProps {
  amount: number;
  /** Masked recipient label only, e.g. "ป้า••• · ผู้ขาย". Never a raw account number. */
  recipientLabel: string;
  reference: string;
  state?: 'ready' | 'loading';
  onOpenBankApp?: () => void;
  className?: string;
}

export const QrPayCard: React.FC<QrPayCardProps> = ({
  amount,
  recipientLabel,
  reference,
  state = 'ready',
  onOpenBankApp,
  className,
}) => {
  const cells = buildQrCells(`gongdong-${reference}-${amount}`);

  return (
    <section
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white p-4 space-y-3',
        className
      )}
      aria-label="ชำระเงินด้วยคิวอาร์พร้อมเพย์"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <QrCode className="w-4 h-4 text-[var(--color-primary)]" />
          สแกนจ่ายด้วยแอปธนาคาร
        </span>
        <span className="text-[10px] text-slate-400">ออเดอร์ {reference}</span>
      </div>

      <div className="text-center">
        <div className="text-[11px] text-slate-400">ยอดที่ต้องชำระ</div>
        <div className="text-2xl font-black text-slate-900">{formatTHB(amount)}</div>
      </div>

      <div className="mx-auto w-48 h-48 p-2.5 bg-white border border-slate-200 rounded-2xl">
        {state === 'loading' ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[10px]">กำลังสร้างคิวอาร์...</span>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`}
            className="w-full h-full"
            role="img"
            aria-label="คิวอาร์พร้อมเพย์สำหรับชำระเงิน"
          >
            <rect width={QR_SIZE} height={QR_SIZE} fill="#ffffff" />
            {cells.map((filled, index) => {
              const row = Math.floor(index / QR_SIZE);
              const col = index % QR_SIZE;
              if (isFinderArea(row, col) || !filled) return null;
              return (
                <rect key={index} x={col} y={row} width={1} height={1} fill="#0F172A" />
              );
            })}
            {finderOrigins().map((origin) => (
              <g key={`${origin.x}-${origin.y}`}>
                <rect x={origin.x} y={origin.y} width={7} height={7} fill="#0F172A" />
                <rect x={origin.x + 1} y={origin.y + 1} width={5} height={5} fill="#ffffff" />
                <rect x={origin.x + 2} y={origin.y + 2} width={3} height={3} fill="#0F172A" />
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
        <span>ผู้รับเงิน</span>
        <span className="font-semibold text-slate-900">{recipientLabel}</span>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          ตรวจชื่อผู้รับในแอปธนาคารให้ตรงกับร้านก่อนกดโอน · ห้ามโอนเข้าบัญชีที่ส่งมาทางแชท
        </span>
      </div>

      <p className="text-[10px] text-center text-slate-400">
        คิวอาร์ตัวอย่างสำหรับเดโม · ไม่ใช่ข้อมูลพร้อมเพย์จริง
      </p>

      {onOpenBankApp && (
        <button
          type="button"
          onClick={onOpenBankApp}
          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          เปิดแอปธนาคารแล้วกลับมาแนบสลิป
        </button>
      )}
    </section>
  );
};
