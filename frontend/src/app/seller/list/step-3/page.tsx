'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, GradeBadge, Stepper } from '@/components/ui';
import { CameraCapture } from '@/components/v4';
import { useListing } from '@/hooks/useListing';
import { GRADE_CRITERIA } from '@/mocks/seller';
import { PhotoCheck, ListingDefect } from '@/types';
import {
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Camera,
  RefreshCcw,
  Trash2,
} from 'lucide-react';

const DEMO_DEFECT = 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600';

/** Step 3: inspect every photo just taken and mark it good or defective. */
export default function SellerListStep3Page() {
  const router = useRouter();
  const { draft, grade, update, setChecklist } = useListing();
  const [isGradeSheetOpen, setIsGradeSheetOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const photos = [
    { id: 'cover', label: 'ปกหน้า', src: draft.photos.cover },
    { id: 'back', label: 'ปกหลัง', src: draft.photos.back },
    { id: 'spine', label: 'สันหนังสือ', src: draft.photos.spine },
    { id: 'inner', label: 'หน้าด้านใน', src: draft.photos.inner },
  ].filter((photo) => !!photo.src);

  const checks = draft.photoChecks ?? {};

  const syncChecklistAndDefects = (nextChecks: Record<string, PhotoCheck>) => {
    const defectCount = Object.values(nextChecks).filter((c) => c.status === 'DEFECT').length;

    // Sync 5-point checklist with number of defect parts
    setChecklist({
      coverIntact: defectCount < 1,
      noHighlight: defectCount < 2,
      noWaterDamage: defectCount < 3,
      pagesComplete: defectCount < 4,
      noYellowing: defectCount < 5,
    });

    const defectList: ListingDefect[] = photos
      .filter((p) => nextChecks[p.id]?.status === 'DEFECT' && nextChecks[p.id]?.defectPhoto)
      .map((p) => ({
        id: `defect-${p.id}`,
        note: nextChecks[p.id]?.defectNote?.trim() || `ตำหนิบริเวณ${p.label}`,
        photo: nextChecks[p.id]?.defectPhoto,
      }));

    update({ photoChecks: nextChecks, defects: defectList });
    setError(null);
  };

  const setStatus = (id: string, status: PhotoCheck['status']) => {
    const current = checks[id] || { status };
    const nextChecks: Record<string, PhotoCheck> = {
      ...checks,
      [id]: {
        ...current,
        status,
        defectPhoto: status === 'GOOD' ? undefined : current.defectPhoto,
        defectNote: status === 'GOOD' ? undefined : current.defectNote,
      },
    };
    syncChecklistAndDefects(nextChecks);
  };

  const setDefectPhoto = (id: string, url: string) => {
    const current = checks[id] || { status: 'DEFECT' };
    const nextChecks: Record<string, PhotoCheck> = {
      ...checks,
      [id]: {
        ...current,
        status: 'DEFECT',
        defectPhoto: url,
      },
    };
    syncChecklistAndDefects(nextChecks);
  };

  const removeDefectPhoto = (id: string) => {
    const current = checks[id] || { status: 'DEFECT' };
    const nextChecks: Record<string, PhotoCheck> = {
      ...checks,
      [id]: {
        ...current,
        defectPhoto: undefined,
      },
    };
    syncChecklistAndDefects(nextChecks);
  };

  const setDefectNote = (id: string, note: string) => {
    const current = checks[id] || { status: 'DEFECT' };
    const nextChecks: Record<string, PhotoCheck> = {
      ...checks,
      [id]: {
        ...current,
        defectNote: note,
      },
    };
    syncChecklistAndDefects(nextChecks);
  };

  const handleNext = () => {
    const unchecked = photos.filter((photo) => !checks[photo.id]);
    if (unchecked.length) {
      setError(`ยังไม่ได้ตรวจ: ${unchecked.map((p) => p.label).join(', ')}`);
      return;
    }

    const missingPhoto = photos.find(
      (photo) => checks[photo.id]?.status === 'DEFECT' && !checks[photo.id]?.defectPhoto
    );
    if (missingPhoto) {
      setError(`กรุณาถ่ายหรือแนบรูปตำหนิของ “${missingPhoto.label}” (จำเป็น)`);
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
          <strong className="text-amber-700">มีตำหนิ</strong> · หากมีตำหนิให้ถ่ายรูปจุดที่มีตำหนิเพิ่ม
        </p>

        {photos.map((photo) => {
          const check = checks[photo.id];
          const isDefect = check?.status === 'DEFECT';

          return (
            <section
              key={photo.id}
              className={clsx(
                'bg-white rounded-2xl border p-3 space-y-3 transition',
                check?.status === 'GOOD'
                  ? 'border-emerald-300'
                  : isDefect
                  ? 'border-amber-300'
                  : 'border-slate-200'
              )}
            >
              <div className="flex gap-3">
                <img
                  src={photo.src}
                  alt={photo.label}
                  className="w-24 h-24 rounded-xl object-cover bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-bold text-slate-900">{photo.label}</p>
                  <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={`สภาพ ${photo.label}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={check?.status === 'GOOD'}
                      onClick={() => setStatus(photo.id, 'GOOD')}
                      className={clsx(
                        'min-h-[40px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 transition',
                        check?.status === 'GOOD'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> สภาพดี
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isDefect}
                      onClick={() => setStatus(photo.id, 'DEFECT')}
                      className={clsx(
                        'min-h-[40px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1 transition',
                        isDefect
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> มีตำหนิ
                    </button>
                  </div>
                </div>
              </div>

              {/* Defect Details: Photo (Required) + Optional Description */}
              {isDefect && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        รูปถ่ายตำหนิจุดนี้ <span className="text-rose-500">* (จำเป็น)</span>
                      </span>
                      {check?.defectPhoto && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          ✓ แนบรูปแล้ว
                        </span>
                      )}
                    </div>

                    {check?.defectPhoto ? (
                      <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={check.defectPhoto}
                          alt={`ตำหนิ ${photo.label}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setCameraTarget({ id: photo.id, label: `ตำหนิ ${photo.label}` })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RefreshCcw className="w-3 h-3" /> เปลี่ยนรูป
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDefectPhoto(photo.id)}
                            className="p-1.5 rounded-lg bg-rose-600/90 text-white"
                            aria-label="ลบรูปตำหนิ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setCameraTarget({ id: photo.id, label: `ตำหนิ ${photo.label}` })
                        }
                        className="w-full h-24 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 flex flex-col items-center justify-center gap-1 text-amber-800 transition"
                      >
                        <Camera className="w-5 h-5 text-amber-600" />
                        <span className="text-xs font-bold">แตะเพื่อถ่ายรูปหรือเลือกรูปตำหนิ</span>
                        <span className="text-[10px] text-amber-600/80">
                          เพื่อให้ผู้ซื้อเห็นจุดตำหนิอย่างชัดเจน
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Optional Text Input */}
                  <div className="space-y-1">
                    <label
                      htmlFor={`note-${photo.id}`}
                      className="text-xs font-semibold text-slate-700 flex justify-between"
                    >
                      <span>รายละเอียดตำหนิ</span>
                      <span className="text-[10px] text-slate-400 font-normal">ไม่บังคับ</span>
                    </label>
                    <input
                      id={`note-${photo.id}`}
                      type="text"
                      placeholder="เช่น มีรอยยับมุมล่าง, รอยดินสอหน้า 15"
                      value={check?.defectNote || ''}
                      onChange={(e) => setDefectNote(photo.id, e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
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
              className={clsx(
                'p-3 rounded-xl border',
                c.grade === grade ? 'border-[var(--color-primary)] bg-emerald-50' : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">เกรด {c.grade} · {c.title}</span>
                <span className="text-xs font-bold text-emerald-700">{c.percent}% ของราคามือหนึ่ง</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{c.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 pt-1">
            นับจำนวนส่วนที่มีตำหนิ: ไม่มี = A · 1 จุด = B · 2 จุด = C · 3 จุดขึ้นไป = D
          </p>
        </div>
      </BottomSheet>

      {/* Camera / Photo Capture for Defect */}
      <CameraCapture
        isOpen={!!cameraTarget}
        mode="PHOTO"
        title={cameraTarget ? `ถ่าย${cameraTarget.label}` : ''}
        hint="ถ่ายจุดที่มีตำหนิให้เห็นชัดเจน"
        demoImage={DEMO_DEFECT}
        onClose={() => setCameraTarget(null)}
        onCapture={(url) => {
          if (!cameraTarget) return;
          setDefectPhoto(cameraTarget.id, url);
          setCameraTarget(null);
        }}
      />
    </div>
  );
}
