'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  BottomSheet,
  ConditionChecklist,
  GradeBadge,
  Stepper,
  Toast,
} from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { GRADE_CRITERIA } from '@/mocks/seller';
import {
  ChevronRight,
  Info,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';

export default function SellerListStep3Page() {
  const router = useRouter();
  const { draft, grade, setChecklist } = useListing();
  const isSet = draft.mode === 'SET';

  const [isGradeSheetOpen, setIsGradeSheetOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const defectCount = Object.values(draft.checklist).filter((v) => !v).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ตรวจสภาพหนังสือ" onBack={() => router.push('/seller/list/step-2')} />

      <Stepper currentStep={3} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isSet ? 'ขั้นที่ 3 · ตรวจสภาพ 5 จุด (S3CB)' : 'ขั้นที่ 3 · ตรวจสภาพ 5 จุด (S3C)'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                ตอบตามจริงทุกจุด ระบบจะคำนวณเกรดให้อัตโนมัติ
                ผู้ซื้อจะเห็นคำตอบของคุณทั้งหมด
              </p>
            </div>
          </div>

          <ConditionChecklist
            value={draft.checklist}
            onChange={(next) => {
              setChecklist(next);
              setToastMessage('คำนวณเกรดใหม่แล้ว (TGRADE)');
            }}
          />
        </div>

        {/* Auto grade result */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              เกรดที่ระบบคำนวณได้
            </span>
            <button
              type="button"
              onClick={() => setIsGradeSheetOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:underline"
            >
              <Info className="w-3.5 h-3.5" />
              ดูเกณฑ์การให้เกรด
            </button>
          </div>

          <div className="flex items-center justify-between">
            <GradeBadge grade={grade} size="lg" />
            <div className="text-right">
              <div className="text-[11px] text-slate-400">ตำหนิที่พบ</div>
              <div className="text-sm font-bold text-slate-800">{defectCount} จุด</div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              เกรดนี้ใช้คำนวณราคาแนะนำในขั้นถัดไป และยืนยันด้วยรูปถ่ายจริงของคุณ
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 leading-relaxed px-1">
          หมายเหตุ: การตอบไม่ตรงกับรูปถ่ายอาจถูกผู้ซื้อรายงาน และแอดมินอาจระงับบัญชี
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={() => router.push('/seller/list/step-4')}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ถัดไป · ตั้งราคาและวิธีรับ
          </Button>
        </div>
      </div>

      {/* GRADE — auto-grade criteria (4 levels) */}
      <BottomSheet
        isOpen={isGradeSheetOpen}
        onClose={() => setIsGradeSheetOpen(false)}
        title="เกณฑ์การให้เกรด (GRADE)"
      >
        <div className="space-y-2 py-1">
          {GRADE_CRITERIA.map((c) => (
            <div
              key={c.grade}
              className={`p-3 rounded-xl border ${
                c.grade === grade
                  ? 'border-[#06C755] bg-emerald-50/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  เกรด {c.grade} · {c.title}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {c.percent}% ของราคาปก
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {c.detail}
              </p>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
            ระบบนับจากคำตอบ 5 จุด: ไม่มีตำหนิ = A · 1 จุด = B · 2 จุด = C · 3 จุดขึ้นไป = D
          </p>
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={`เกรด ${grade} · ${toastMessage || ''}`}
      />
    </div>
  );
}
