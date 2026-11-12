'use client';

import React from 'react';
import clsx from 'clsx';
import { OrderStatus } from '@/types';

export interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; styles: string; dotColor: string }> = {
  PENDING_ACCEPT: {
    label: 'รอผู้ขายรับ',
    styles: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
  },
  WAITING_PAYMENT: {
    label: 'รอชำระเงิน',
    styles: 'bg-blue-50 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
  },
  PAYMENT_SUBMITTED: {
    label: 'แนบสลิปแล้ว',
    styles: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotColor: 'bg-indigo-500',
  },
  PREPARING_SHIPPING: {
    label: 'กำลังจัดเตรียม',
    styles: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dotColor: 'bg-cyan-500',
  },
  SHIPPED: {
    label: 'จัดส่งแล้ว',
    styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  MEETUP_CONFIRMED: {
    label: 'นัดรับสำเร็จ',
    styles: 'bg-teal-50 text-teal-700 border-teal-200',
    dotColor: 'bg-teal-500',
  },
  COMPLETED: {
    label: 'สำเร็จแล้ว',
    styles: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-600',
  },
  CANCELLED: {
    label: 'ยกเลิกแล้ว',
    styles: 'bg-slate-100 text-slate-600 border-slate-200',
    dotColor: 'bg-slate-400',
  },
  REPORTED: {
    label: 'เปิดข้อพิพาท',
    styles: 'bg-rose-50 text-rose-700 border-rose-200',
    dotColor: 'bg-rose-500',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    styles: 'bg-slate-100 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-500',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium border rounded-full select-none',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        config.styles,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', config.dotColor)} />
      <span>{config.label}</span>
    </span>
  );
};

