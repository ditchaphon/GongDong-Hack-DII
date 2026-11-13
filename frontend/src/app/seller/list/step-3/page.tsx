'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, GradeBadge, Stepper } from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { GRADE_CRITERIA } from '@/mocks/seller';
import { ConditionChecklist, PhotoCheck } from '@/types';
import { ChevronRight, Info, CheckCircle2, AlertTriangle } from 'lucide-react';

type IssueKey = keyof ConditionChecklist;

const ISSUES: { key: IssueKey; label: string }[] = [
  { key: 'coverIntact', label: 'ปกฉีก/พับ' },
  { key: 'noHighlight', label: 'รอยเขียน/ไฮไลต์' },
  { key: 'noWaterDamage', label: 'คราบน้ำ/เปื้อน' },
  { key: 'pagesComplete', label: 'หน้าหลุด/ไม่ครบ' },
  { key: 'noYellowing', label: 'สันย่น/กระดาษเหลือง' },
];

/** Step 3: inspect every photo just taken and mark it good or defective. */
export default function SellerListStep3Page() {
  const router = useRouter();
  const { draft, grade, update, setChecklist } = useListing();
  const [isGradeSheetOpen, setIsGradeSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photos = [
    { id: 'cover', label: 'ปกหน้า', src: draft.photos.cover },
    { id: 'back', label: 'ปกหลัง', src: draft.photos.back },
    { id: 'spine', label: 'สันหนังสือ', src: draft.photos.spine },
    { id: 'inner', label: 'หน้าด้านใน', src: draft.photos.inner },
    ...draft.defects.map((defect, index) => ({ id: defect.id, label: `รูปตำหนิ ${index + 1}`, src: defect.photo })),
  ].filter((photo) => !!photo.src);

  const checks = draft.photoChecks ?? {};

  const writeChecks = (next: Record<string, PhotoCheck>) => {
    const failed = new Set<IssueKey>();
    Object.values(next).forEach((check) => {
      if (check.status === 'DEFECT') check.issues.forEach((issue) => failed.add(issue));
    });
    update({ photoChecks: next });
    setChecklist({
      coverIntact: !failed.has('coverIntact'),
      noHighlight: !failed.has('noHighlight'),
      noWaterDamage: !failed.has('noWaterDamage'),
      pagesComplete: !failed.has('pagesComplete'),
      noYellowing: !failed.has('noYellowing'),
    });
    setError(null);
  };

  const setStatus = (id: string, status: PhotoCheck['status']) =>
    writeChecks({ ...checks, [id]: { status, issues: status === 'GOOD' ? [] : checks[id]?.issues ?? [] } });

  const toggleIssue = (id: string, issue: IssueKey) => {
    const current = checks[id]?.issues ?? [];
    const issues = current.includes(issue) ? current.filter((i) => i !== issue) : [...current, issue];
    writeChecks({ ...checks, [id]: { status: 'DEFECT', issues } });
  };

  const handleNext = () => {
    const unchecked = photos.filter((photo) => !checks[photo.id]);
    if (unchecked.length) {
      setError(`ยังไม่ได้ตรวจ: ${unchecked.map((p) => p.label).join(', ')}`);
      return;
    }
    const missingIssue = photos.find((photo) => checks[photo.id]?.status === 'DEFECT' && !checks[photo.id].issues.length);
    if (missingIssue) {
      setError(`เลือกประเภทตำหนิของ “${missingIssue.label}”`);
      return;
    }
    router.push('/seller/list/step-4');
  };

  const defectPhotos = photos.filter((photo) => checks[photo.id]?.status === 'DEFECT').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ตรวจสภาพหนังสือ" onBack={() => router.push('/seller/list/step-2')} />
      <Stepper currentStep={4} />

      <div className="p-4 space-y-4">
        <p className="text-[11px] text-slate-500 leading-relaxed px-1">
          ดูรูปทีละรูป แล้วติ๊กว่า <strong className="text-emerald-700">สภาพดี</strong> หรือ{' '}
          <strong className="text-amber-700">มีตำหนิ</strong> · ผู้ซื้อจะเห็นผลตรวจนี้คู่กับรูป
        </p>

        {photos.map((photo) => {
          const check = checks[photo.id];
          return (
            <section
              key={photo.id}
              className={clsx(
                'bg-white rounded-2xl border p-3 space-y-3',
                check?.status === 'GOOD' ? 'border-emerald-300' : check?.status === 'DEFECT' ? 'border-amber-300' : 'border-slate-200'
              )}
            >
              <div className="flex gap-3">
                <img src={photo.src} alt={photo.label} className="w-24 h-24 rounded-xl object-cover bg-slate-100 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-bold text-slate-900">{photo.label}</p>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={`สภาพ ${photo.label}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={check?.status === 'GOOD'}
                      onClick={() => setStatus(photo.id, 'GOOD')}
                      className={clsx(
                        'min-h-[40px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1',
                        check?.status === 'GOOD' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 text-slate-600'
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> สภาพดี
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={check?.status === 'DEFECT'}
                      onClick={() => setStatus(photo.id, 'DEFECT')}
                      className={clsx(
                        'min-h-[40px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1',
                        check?.status === 'DEFECT' ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-200 text-slate-600'
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> มีตำหนิ
                    </button>
                  </div>
                </div>
              </div>
              {check?.status === 'DEFECT' && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {ISSUES.map((issue) => {
                    const on = check.issues.includes(issue.key);
                    return (
                      <button
                        key={issue.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleIssue(photo.id, issue.key)}
                        className={clsx(
                          'px-2.5 py-1 rounded-full text-[11px] font-semibold border mt-2',
                          on ? 'bg-amber-50 border-amber-400 text-amber-800' : 'border-slate-200 text-slate-500'
                        )}
                      >
                        {on ? '✓ ' : ''}
                        {issue.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">เกรดที่ระบบคำนวณจากผลตรวจ</span>
            <button
              type="button"
              onClick={() => setIsGradeSheetOpen(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-dark)]"
            >
              <Info className="w-3.5 h-3.5" /> เกณฑ์เกรด
            </button>
          </div>
          <div className="flex items-center justify-between">
            <GradeBadge grade={grade} size="lg" />
            <div className="text-right text-[11px] text-slate-500">
              รูปมีตำหนิ <strong className="text-slate-800">{defectPhotos}</strong> / {photos.length}
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" onClick={handleNext} rightIcon={<ChevronRight className="w-4 h-4" />}>
            ถัดไป · ตั้งราคาและวิธีส่ง
          </Button>
        </div>
      </div>

      <BottomSheet isOpen={isGradeSheetOpen} onClose={() => setIsGradeSheetOpen(false)} title="เกณฑ์การให้เกรด">
        <div className="space-y-2 py-1">
          {GRADE_CRITERIA.map((c) => (
            <div
              key={c.grade}
              className={clsx('p-3 rounded-xl border', c.grade === grade ? 'border-[var(--color-primary)] bg-emerald-50' : 'border-slate-200')}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">เกรด {c.grade} · {c.title}</span>
                <span className="text-xs font-bold text-emerald-700">{c.percent}% ของราคาปก</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{c.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 pt-1">นับประเภทตำหนิที่พบ: ไม่มี = A · 1 = B · 2 = C · 3 ขึ้นไป = D</p>
        </div>
      </BottomSheet>
    </div>
  );
}
