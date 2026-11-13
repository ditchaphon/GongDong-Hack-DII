'use client';

import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';

export interface StepItem {
  step: number;
  title: string;
}

export interface StepperProps {
  currentStep: number;
  steps?: StepItem[];
  onStepClick?: (step: number) => void;
  className?: string;
}

const DEFAULT_STEPS: StepItem[] = [
  { step: 1, title: 'ISBN' },
  { step: 2, title: 'รายละเอียด' },
  { step: 3, title: 'รูปถ่าย' },
  { step: 4, title: 'สภาพ' },
  { step: 5, title: 'ราคา/ส่ง' },
];

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  steps = DEFAULT_STEPS,
  onStepClick,
  className,
}) => {
  return (
    <div className={clsx('w-full py-3 px-2 select-none', className)}>
      <div className="flex items-center justify-between relative">
        {/* Track Line behind steps */}
        <div className="absolute left-6 right-6 top-3.5 h-0.5 bg-slate-200 -z-0" />
        <div
          className="absolute left-6 top-3.5 h-0.5 bg-[#8B5E3C] -z-0 transition-all duration-300"
          style={{
            width: `${Math.max(0, Math.min(100, ((currentStep - 1) / (steps.length - 1)) * 100))}%`,
          }}
        />

        {steps.map((s) => {
          const isCompleted = s.step < currentStep;
          const isCurrent = s.step === currentStep;

          return (
            <div
              key={s.step}
              onClick={() => onStepClick?.(s.step)}
              className={clsx(
                'flex flex-col items-center gap-1.5 z-10',
                onStepClick && 'cursor-pointer'
              )}
            >
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs',
                  isCompleted
                    ? 'bg-[#8B5E3C] text-white ring-2 ring-emerald-100'
                    : isCurrent
                    ? 'bg-slate-900 text-white ring-4 ring-slate-100'
                    : 'bg-white text-slate-400 border-2 border-slate-200'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.step}
              </div>
              <span
                className={clsx(
                  'text-[11px] font-medium transition-colors',
                  isCurrent ? 'text-slate-900 font-bold' : isCompleted ? 'text-[#8B5E3C]' : 'text-slate-400'
                )}
              >
                {s.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

