'use client';

import React from 'react';
import clsx from 'clsx';
import { ConditionChecklist as ConditionChecklistType, BookGrade } from '@/types';
import { Check, AlertCircle } from 'lucide-react';

export interface ConditionChecklistProps {
  value: ConditionChecklistType;
  onChange?: (val: ConditionChecklistType) => void;
  readOnly?: boolean;
  className?: string;
}

interface ChecklistItemMeta {
  key: keyof ConditionChecklistType;
  title: string;
  description: string;
}

const CHECKLIST_ITEMS: ChecklistItemMeta[] = [
  {
    key: 'coverIntact',
    title: '1. ปกหน้าและปกหลัง',
    description: 'ไม่ฉีกขาด ไม่พับยับ ไม่มีรอยถลอกลึก',
  },
  {
    key: 'noHighlight',
    title: '2. รอยขีดเขียน / ไฮไลต์',
    description: 'ไม่มีปากกา ไฮไลต์ หรือรอยดินสอหนาเตอะ',
  },
  {
    key: 'noWaterDamage',
    title: '3. รอยเปื้อน / คราบน้ำ',
    description: 'ไม่มีคราบน้ำบวม หรือจุดเหลือง/เชื้อรา',
  },
  {
    key: 'pagesComplete',
    title: '4. หน้ากระดาษครบถ้วน',
    description: 'หน้าครบ ไม่หลุด ไม่มีเทปใสแปะซ่อม',
  },
  {
    key: 'noYellowing',
    title: '5. สันปกและขอบกระดาษ',
    description: 'สันไม่แบะ สันไม่ย่น ขอบกระดาษไม่เหลืองคล้ำ',
  },
];

export function calculateGrade(checklist: ConditionChecklistType): BookGrade {
  // Count passed items (true = no defect)
  const items = [
    checklist.coverIntact,
    checklist.noHighlight,
    checklist.noWaterDamage,
    checklist.pagesComplete,
    checklist.noYellowing,
  ];
  const passedCount = items.filter(Boolean).length;
  const defectCount = 5 - passedCount;

  if (defectCount === 0) return 'A';
  if (defectCount === 1) return 'B';
  if (defectCount === 2) return 'C';
  return 'D';
}

export const ConditionChecklist: React.FC<ConditionChecklistProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
}) => {
  const handleToggle = (key: keyof ConditionChecklistType) => {
    if (readOnly || !onChange) return;
    onChange({
      ...value,
      [key]: !value[key],
    });
  };

  return (
    <div className={clsx('flex flex-col gap-2.5', className)}>
      {CHECKLIST_ITEMS.map((item) => {
        const isClean = value[item.key]; // true = clean, false = defect

        return (
          <div
            key={item.key}
            onClick={() => handleToggle(item.key)}
            className={clsx(
              'flex items-center justify-between p-3.5 rounded-2xl border transition-all select-none',
              !readOnly && 'cursor-pointer active:scale-[0.99]',
              isClean
                ? 'bg-emerald-50/50 border-emerald-200'
                : 'bg-amber-50/50 border-amber-200'
            )}
          >
            <div className="flex-1 pr-3">
              <h5 className="font-semibold text-sm text-slate-800">{item.title}</h5>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.description}</p>
            </div>

            <div className="shrink-0">
              {isClean ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-2.5 py-1 rounded-xl shadow-2xs">
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                  <span>สมบูรณ์</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-white border border-amber-300 px-2.5 py-1 rounded-xl shadow-2xs">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>มีตำหนิ</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

