'use client';

import React from 'react';
import clsx from 'clsx';
import { Truck, AlertCircle } from 'lucide-react';
import { Countdown } from '@/components/ui/Countdown';
import { Button } from '@/components/ui/Button';
import { PhotoUploader } from '@/components/ui/PhotoUploader';

export interface TrackingValue {
  carrier: string;
  trackingNumber: string;
  boxPhoto: string;
}

export interface TrackingFormProps {
  value: TrackingValue;
  onChange: (patch: Partial<TrackingValue>) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  deferUpload?: boolean;
  error?: string;
  deadlineISO?: string;
  className?: string;
}

const CARRIERS = [
  'Flash Express',
  'Kerry Express',
  'ไปรษณีย์ไทย',
  'J&T Express',
  'SPX Express',
];

export const TrackingForm: React.FC<TrackingFormProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  deferUpload = false,
  error,
  deadlineISO,
  className,
}) => {
  const canSubmit =
    !!value.carrier && value.trackingNumber.trim().length >= 6 && !!value.boxPhoto;

  return (
    <section className={clsx('space-y-3', className)} aria-label="แจ้งจัดส่งพัสดุ">
      {deadlineISO && (
        <Countdown targetDate={deadlineISO} label="ต้องแจ้งเลขพัสดุภายใน" />
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="carrier" className="text-xs font-semibold text-slate-700">
          ขนส่ง
        </label>
        <div className="relative">
          <Truck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            id="carrier"
            value={value.carrier}
            onChange={(event) => onChange({ carrier: event.target.value })}
            className="w-full min-h-[44px] pl-10 pr-3 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
          >
            <option value="">เลือกขนส่ง</option>
            {CARRIERS.map((carrier) => (
              <option key={carrier} value={carrier}>
                {carrier}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="tracking" className="text-xs font-semibold text-slate-700">
          เลขพัสดุ
        </label>
        <input
          id="tracking"
          value={value.trackingNumber}
          onChange={(event) => onChange({ trackingNumber: event.target.value.toUpperCase() })}
          placeholder="เช่น TH0123456789CM"
          className="w-full min-h-[44px] px-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>

      <PhotoUploader
        label="รูปกล่องพัสดุ"
        bucket="order-receives"
        deferUpload={deferUpload}
        isRequired
        previewUrl={value.boxPhoto}
        onChange={(url) => onChange({ boxPhoto: url })}
        onRemove={() => onChange({ boxPhoto: '' })}
        description="ถ่ายให้เห็นป้ายที่อยู่และเลขพัสดุชัดเจน"
      />

      {error && (
        <p className="flex items-start gap-1 text-[11px] text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <Button fullWidth size="lg" onClick={onSubmit} isLoading={isLoading} disabled={!canSubmit}>
        ยืนยันการจัดส่ง
      </Button>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        ที่อยู่และเบอร์ผู้รับจะแสดงเฉพาะในช่วง PAID/SHIPPED และซ่อนอีกครั้งเมื่อปิดออเดอร์
      </p>
    </section>
  );
};
