'use client';

import React from 'react';
import clsx from 'clsx';
import { ShieldCheck, CheckCircle2, Tag, MapPin } from 'lucide-react';

export type TrustType = 'promptpay' | 'blacklist' | 'nametag' | 'meetup';

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
    promptpay: {
      defaultLabel: 'พร้อมเพย์ตรงชื่อ ✓',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />,
      styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    blacklist: {
      defaultLabel: 'ตรวจ Blacklist ผ่าน ✓',
      icon: <ShieldCheck className="w-3 h-3 text-blue-600 shrink-0" />,
      styles: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    nametag: {
      defaultLabel: 'มีป้ายชื่อจริง 🏷️',
      icon: <Tag className="w-3 h-3 text-amber-600 shrink-0" />,
      styles: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    meetup: {
      defaultLabel: 'นัดรับ ฿0',
      icon: <MapPin className="w-3 h-3 text-teal-600 shrink-0" />,
      styles: 'bg-teal-50 text-teal-700 border-teal-200',
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

