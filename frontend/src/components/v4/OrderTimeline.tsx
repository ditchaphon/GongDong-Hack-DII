'use client';

import React from 'react';
import clsx from 'clsx';
import { Check, X, AlertTriangle } from 'lucide-react';
import { V4Order, V4OrderStatus } from '@/types/v4';
import {
  MAIN_PATH,
  STATUS_META,
  isTerminal,
  timelineIndex,
} from '@/lib/orderStateMachine';

export interface OrderTimelineProps {
  order: Pick<V4Order, 'status' | 'delivery'>;
  className?: string;
}

const STEP_LABEL: Record<V4OrderStatus, string> = {
  REQUESTED: 'ส่งคำขอ',
  ACCEPTED: 'ผู้ขายรับ',
  SCHEDULED: 'นัดรับ',
  PAID: 'ชำระเงิน',
  SHIPPED: 'จัดส่ง',
  COMPLETED: 'สำเร็จ',
  REJECTED: 'ถูกปฏิเสธ',
  EXPIRED: 'หมดเวลา',
  CANCELLED: 'ยกเลิก',
  DISPUTED: 'ตรวจสอบ',
};

export const OrderTimeline: React.FC<OrderTimelineProps> = ({ order, className }) => {
  const steps = MAIN_PATH[order.delivery];
  const currentIndex = timelineIndex(order.delivery, order.status);
  const failed =
    order.status === 'REJECTED' || order.status === 'EXPIRED' || order.status === 'CANCELLED';
  const disputed = order.status === 'DISPUTED';
  const completed = order.status === 'COMPLETED';

  return (
    <div className={clsx('w-full select-none', className)}>
      <div className="flex items-start">
        {steps.map((step, index) => {
          const isDone =
            completed || (currentIndex > -1 && index < currentIndex);
          const isCurrent = !completed && index === currentIndex;

          return (
            <React.Fragment key={step}>
              {index > 0 && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mt-3.5',
                    isDone ? 'bg-[var(--color-primary)]' : 'bg-slate-200'
                  )}
                />
              )}
              <div className="flex flex-col items-center gap-1 w-14 shrink-0">
                <div
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border',
                    isDone
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                      : isCurrent
                      ? disputed
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : failed
                        ? 'bg-slate-400 border-slate-400 text-white'
                        : 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-400'
                  )}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : disputed && isCurrent ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : failed && isCurrent ? (
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={clsx(
                    'text-[10px] text-center leading-tight',
                    isCurrent
                      ? 'font-bold text-slate-900'
                      : isDone
                      ? 'text-[var(--color-primary-dark)]'
                      : 'text-slate-400'
                  )}
                >
                  {STEP_LABEL[step]}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {(failed || disputed) && (
        <div
          className={clsx(
            'mt-3 flex items-start gap-2 p-2.5 rounded-xl border text-[11px] leading-relaxed',
            disputed
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          )}
        >
          {disputed ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          ) : (
            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          )}
          <span>
            {STATUS_META[order.status].label} — {STATUS_META[order.status].explanation}
            {isTerminal(order.status) ? ' · ไม่ต้องดำเนินการต่อ' : ''}
          </span>
        </div>
      )}
    </div>
  );
};
