'use client';

import React from 'react';
import clsx from 'clsx';
import { ArrowRight, Clock, UserRound } from 'lucide-react';
import { V4Order, ViewRole } from '@/types/v4';
import { ActionKey, getNextAction, getTimerInfo } from '@/lib/orderStateMachine';
import { Countdown } from '@/components/ui/Countdown';
import { Button } from '@/components/ui/Button';

export interface NextActionCardProps {
  order: V4Order;
  role: ViewRole;
  onAction?: (key: ActionKey) => void;
  className?: string;
}

const WHO_LABEL: Record<string, string> = {
  BUYER: 'ผู้ซื้อต้องทำ',
  SELLER: 'ผู้ขายต้องทำ',
  BOTH: 'ทั้งสองฝ่าย',
  ADMIN: 'แอดมินกำลังทำ',
  NONE: 'ไม่มีขั้นตอนค้าง',
};

export const NextActionCard: React.FC<NextActionCardProps> = ({
  order,
  role,
  onAction,
  className,
}) => {
  const action = getNextAction(order, role);
  const timer = getTimerInfo(order);
  const waitingOnMe =
    (role === 'BUYER' && action.whoActs === 'BUYER') ||
    (role === 'SELLER' && action.whoActs === 'SELLER');

  return (
    <section
      className={clsx(
        'rounded-2xl border p-4 space-y-3',
        waitingOnMe
          ? 'bg-emerald-50/60 border-emerald-200'
          : 'bg-white border-slate-200',
        className
      )}
      aria-label="ขั้นตอนถัดไป"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
            waitingOnMe
              ? 'bg-white text-emerald-700 border-emerald-300'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          )}
        >
          <UserRound className="w-3 h-3" />
          {WHO_LABEL[action.whoActs]}
        </span>
        {timer && (
          <Countdown
            targetDate={timer.deadline.toISOString()}
            variant="badge"
          />
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900">{action.title}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          {action.description}
        </p>
      </div>

      {timer && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timer.label}</span>
        </div>
      )}

      {action.primaryLabel && (
        <Button
          fullWidth
          size="md"
          onClick={() => onAction?.(action.key)}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {action.primaryLabel}
        </Button>
      )}
    </section>
  );
};
