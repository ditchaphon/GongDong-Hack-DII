'use client';

import React from 'react';
import clsx from 'clsx';
import { BookGrade } from '@/types';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from './Button';

export interface PriceSuggestProps {
  originalPrice: number;
  grade: BookGrade;
  onApplyPrice?: (price: number) => void;
  currentPrice?: number;
  className?: string;
}

const GRADE_PERCENTAGES: Record<BookGrade, number> = {
  A: 0.75, // 75%
  B: 0.60, // 60%
  C: 0.45, // 45%
  D: 0.30, // 30%
};

export const PriceSuggest: React.FC<PriceSuggestProps> = ({
  originalPrice,
  grade,
  onApplyPrice,
  currentPrice,
  className,
}) => {
  const percent = GRADE_PERCENTAGES[grade] || 0.6;
  const suggestedPrice = Math.round(originalPrice * percent); // match backend gradingService integer baht rounding

  return (
    <div
      className={clsx(
        'p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl select-none',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>ราคาแนะนำโดยระบบ (เกรด {grade} • {Math.round(percent * 100)}%)</span>
        </div>
        <span className="text-xs text-slate-400">จากราคาปก ฿{originalPrice}</span>
      </div>

      <div className="flex items-baseline justify-between mt-3">
        <div>
          <span className="text-2xl font-black text-[#8B5E3C]">
            ฿{suggestedPrice.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 ml-1.5 font-medium">
            (ประหยัดไป ฿{(originalPrice - suggestedPrice).toLocaleString()})
          </span>
        </div>

        {onApplyPrice && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApplyPrice(suggestedPrice)}
            className="text-xs bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50 shadow-2xs"
          >
            ใช้ราคานี้
          </Button>
        )}
      </div>
    </div>
  );
};

