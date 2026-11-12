'use client';

import React from 'react';
import clsx from 'clsx';
import { CalendarDays, Clock } from 'lucide-react';

export interface ScheduleValue {
  dateISO: string;
  timeLabel: string;
}

export interface DateTimePickerProps {
  value: ScheduleValue | null;
  onChange: (value: ScheduleValue) => void;
  error?: string;
  className?: string;
}

const TIME_SLOTS = [
  '09:00 - 09:30',
  '10:00 - 10:30',
  '12:00 - 12:30',
  '13:00 - 13:30',
  '15:00 - 15:30',
  '16:30 - 17:00',
  '17:00 - 17:30',
  '18:00 - 18:30',
];

const THAI_DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export function nextDays(count = 7): { iso: string; dayLabel: string; dateLabel: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
      iso: date.toISOString().slice(0, 10),
      dayLabel: index === 0 ? 'วันนี้' : index === 1 ? 'พรุ่งนี้' : THAI_DAYS[date.getDay()],
      dateLabel: `${date.getDate()} ${THAI_MONTHS[date.getMonth()]}`,
    };
  });
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  error,
  className,
}) => {
  const days = nextDays(7);
  const selectedDate = value?.dateISO ?? days[1].iso;

  return (
    <div className={clsx('space-y-3', className)}>
      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          วันที่นัดรับ
        </span>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map((day) => {
            const selected = day.iso === selectedDate;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() =>
                  onChange({ dateISO: day.iso, timeLabel: value?.timeLabel ?? TIME_SLOTS[5] })
                }
                className={clsx(
                  'shrink-0 w-16 py-2 rounded-xl border text-center transition',
                  selected
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                <span className="block text-[11px] font-semibold">{day.dayLabel}</span>
                <span
                  className={clsx(
                    'block text-[10px]',
                    selected ? 'text-white/85' : 'text-slate-400'
                  )}
                >
                  {day.dateLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          ช่วงเวลา
        </span>
        <div className="grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((slot) => {
            const selected = value?.timeLabel === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onChange({ dateISO: selectedDate, timeLabel: slot })}
                className={clsx(
                  'min-h-[40px] rounded-xl border text-[11px] font-medium transition',
                  selected
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
};
