'use client';

import React from 'react';
import clsx from 'clsx';
import { CheckCircle2, Tag, MapPin, Truck } from 'lucide-react';

/**
 * v4 trust badges. These describe what was verified, never a real name, payee
 * name or contact channel — buyers see the shop name only.
 */
export type TrustType = 'payee' | 'nametag' | 'meetup' | 'parcel';

export interface TrustBadgeProps {
  type: TrustType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({
  type,
  label,
  size = 'sm',
  className,
}) => {
  const configs = {
    payee: {
      defaultLabel: 'ยืนยันบัญชีรับเงินแล้ว',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
      styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    nametag: {
      defaultLabel: 'ป้ายชื่อร้าน + วันที่',
      icon: <Tag className="w-3 h-3 text-amber-600 shrink-0" />,
      styles: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    meetup: {
      defaultLabel: 'นัดรับ ฿0',
      icon: <MapPin className="w-3 h-3 text-teal-600 shrink-0" />,
      styles: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    parcel: {
      defaultLabel: 'ส่งพัสดุได้',
      icon: <Truck className="w-3 h-3 text-slate-500 shrink-0" />,
      styles: 'bg-slate-50 text-slate-700 border-slate-200',
    },
  };

  const config = configs[type];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-medium border rounded-full select-none',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        config.styles,
        className
      )}
    >
      {config.icon}
      <span>{label || config.defaultLabel}</span>
    </span>
  );
};
