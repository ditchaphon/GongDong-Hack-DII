'use client';

import React from 'react';
import clsx from 'clsx';
import { Check, Send, MapPin, Star, Package, Truck, PackageCheck } from 'lucide-react';
import { V4Order } from '@/types/v4';

type StepDef = { title: string; icon: React.ComponentType<{ className?: string }> };

const MEETUP_STEPS: StepDef[] = [
  { title: 'ส่งคำขอ', icon: Send },
  { title: 'นัดรับ', icon: MapPin },
  { title: 'สำเร็จ', icon: Star },
];

const PARCEL_STEPS: StepDef[] = [
  { title: 'ส่งคำขอ', icon: Send },
  { title: 'รอจัดส่ง', icon: Package },
  { title: 'กำลังส่ง', icon: Truck },
  { title: 'ได้รับของ', icon: PackageCheck },
];

/** 0-based active step; equals steps.length when everything is done. */
export function orderStepIndex(order: Pick<V4Order, 'status' | 'delivery'>): number {
  const { status, delivery } = order;
  if (delivery === 'MEETUP') {
    if (status === 'REQUESTED') return 0;
    if (status === 'SCHEDULED' || status === 'ACCEPTED' || status === 'DISPUTED') return 1;
    if (status === 'COMPLETED') return 3;
    return 0;
  }
  if (status === 'REQUESTED') return 0;
  if (status === 'ACCEPTED' || status === 'PAID') return 1;
  if (status === 'SHIPPED' || status === 'DISPUTED') return 2;
  if (status === 'COMPLETED') return 4;
  return 0;
}

export const OrderSteps: React.FC<{ order: Pick<V4Order, 'status' | 'delivery'>; className?: string }> = ({
  order,
  className,
}) => {
  const steps = order.delivery === 'MEETUP' ? MEETUP_STEPS : PARCEL_STEPS;
  const active = orderStepIndex(order);
  const stopped = ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(order.status);

  return (
    <ol className={clsx('flex items-start', className)} aria-label="ขั้นตอนออเดอร์">
      {steps.map((step, index) => {
        const done = index < active;
        const current = index === active && !stopped;
        const Icon = step.icon;
        return (
          <li key={step.title} className="flex-1 flex flex-col items-center relative">
            {index > 0 && (
              <span
                aria-hidden
                className={clsx('absolute top-[18px] h-0.5', index <= active && !stopped ? 'bg-[var(--color-primary)]' : 'bg-slate-200')}
                style={{ left: 'calc(-50% + 1.4rem)', right: 'calc(50% + 1.4rem)' }}
              />
            )}
            <span
              aria-current={current ? 'step' : undefined}
              className={clsx(
                'relative z-10 w-9 h-9 rounded-full flex items-center justify-center',
                done
                  ? 'bg-[var(--color-primary)] text-white'
                  : current
                  ? 'bg-white border-2 border-[var(--color-primary)] text-[var(--color-primary)] ring-4 ring-emerald-100'
                  : 'bg-white border-2 border-slate-200 text-slate-300'
              )}
            >
              {done ? <Check className="w-4 h-4 stroke-[3]" /> : <Icon className="w-4 h-4" />}
            </span>
            <span
              className={clsx(
                'mt-1.5 text-[10px] text-center leading-tight',
                current ? 'font-bold text-emerald-800' : done ? 'font-semibold text-slate-700' : 'text-slate-400'
              )}
            >
              {step.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
