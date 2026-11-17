'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, GradeBadge, Stepper } from '@/components/ui';
import { AdminDemoBanner, CameraCapture, PhotoGallery } from '@/components/v4';
import { useLiff } from '@/hooks/useLiff';
import { useListing } from '@/hooks/useListing';
import { safeDeleteUploadedImage } from '@/lib/api';
import { GRADE_CRITERIA } from '@/lib/catalog';
import { ConditionChecklist, ListingDefect } from '@/types';
import {
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Camera,
  RefreshCcw,
  ZoomIn,
} from 'lucide-react';

type IssueKey = keyof ConditionChecklist;

interface ConditionItemSpec {
  key: IssueKey;
  number: number;
  title: string;
  goodDesc: string;
  defectDefaultLabel: string;
  notePlaceholder: string;
  demoPhoto: string;
}

const CONDITION_ITEMS: ConditionItemSpec[] = [
  {
    key: 'coverIntact',
    number: 1,
    title: 'ปกหน้าและปกหลัง',
    goodDesc: 'ไม่มีรอยฉีกขาด พับงอ หรือหลุดออกจากเล่ม',
    defectDefaultLabel: 'ปกหน้า/ปกหลังมีรอยพับหรือฉีกขาด',
    notePlaceholder: 'เช่น มุมปกขวาล่างพับเล็กน้อย (ไม่บังคับ)',
    demoPhoto: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  },
  {
    key: 'noHighlight',
    number: 2,
    title: 'รอยขีดเขียน / ไฮไลต์',
    goodDesc: 'ไม่มีรอยปากกา ดินสอ หรือปากกาเน้นข้อความ',
    defectDefaultLabel: 'มีรอยขีดเขียนหรือไฮไลต์',
    notePlaceholder: 'เช่น มีไฮไลต์สีเหลืองประมาณ 5 หน้า (ไม่บังคับ)',
    demoPhoto: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600',
  },
  {
    key: 'noWaterDamage',
    number: 3,
    title: 'รอยเปื้อน / คราบน้ำ',
    goodDesc: 'ไม่มีคราบน้ำ กระดาษบวม หรือรอยสกปรก',
    defectDefaultLabel: 'มีรอยเปื้อนหรือคราบน้ำ',
    notePlaceholder: 'เช่น ขอบล่างมีรอยคราบน้ำจางๆ (ไม่บังคับ)',
    demoPhoto: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
  },
  {
    key: 'pagesComplete',
    number: 4,
    title: 'หน้ากระดาษครบถ้วน',
    goodDesc: 'หน้าไม่ฉีกขาด ไม่หลุดร่วงจากสันกาว',
    defectDefaultLabel: 'หน้ากระดาษมีรอยขาดหรือหลุดบางหน้า',
    notePlaceholder: 'เช่น หน้าคำนำแบะออกจากสันเล็กน้อย (ไม่บังคับ)',
    demoPhoto: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
  },
  {
    key: 'noYellowing',
    number: 5,
    title: 'สันปกและขอบกระดาษ',
    goodDesc: 'สันกาวแข็งแรง ขอบกระดาษไม่เหลืองคล้ำหนัก',
    defectDefaultLabel: 'สันย่นหรือขอบกระดาษมีจุดเหลือง',
    notePlaceholder: 'เช่น ขอบกระดาษด้านบนมีจุดเหลืองตามกาลเวลา (ไม่บังคับ)',
    demoPhoto: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
  },
];

function extractCustomNote(defect: ListingDefect | undefined, item: ConditionItemSpec): string {
  if (!defect?.note) return '';
  const prefix = `${item.title}: `;
  if (defect.note.startsWith(prefix)) {
    return defect.note.slice(prefix.length);
  }
  if (defect.note === item.defectDefaultLabel || defect.note === item.title) {
    return '';
  }
  return defect.note;
}

function buildDefectNote(item: ConditionItemSpec, customNote: string): string {
  const trimmed = customNote.trim();
  return trimmed ? `${item.title}: ${trimmed}` : item.defectDefaultLabel;
}

/** Step 3: Check 5 book condition criteria and require a photo for any defective item. */
export default function SellerListStep3Page() {
  const router = useRouter();
  const { user } = useLiff();
  const { draft, grade, update, setChecklist } = useListing();
  const isAdminDemoMode = Boolean(user.isAdmin && draft.isDemoDryRun);
  const isSet = draft.mode === 'SET';
  const [isGradeSheetOpen, setIsGradeSheetOpen] = useState(false);
  const [activeCameraItem, setActiveCameraItem] = useState<ConditionItemSpec | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const anglePhotos = [
    { id: 'cover', label: 'ปกหน้า', src: draft.photos.cover, url: draft.photos.cover },
    { id: 'back', label: 'ปกหลัง', src: draft.photos.back, url: draft.photos.back },
    { id: 'spine', label: 'สันหนังสือ', src: draft.photos.spine, url: draft.photos.spine },
    {
      id: 'inner',
      label: 'หน้าด้านใน',
      src: draft.photos.inner || draft.photos.nameTag,
      url: draft.photos.inner || draft.photos.nameTag,
    },
  ].filter((p) => Boolean(p.src));

  const syncDefectsToDraft = (nextDefects: ListingDefect[]) => {
    const defectPhotoUrls = nextDefects
      .map((d) => d.photo)
      .filter((p): p is string => Boolean(p));
    update({
      defects: nextDefects,
      photos: {
        ...draft.photos,
        defects: defectPhotoUrls,
      },
    });
  };

  const getDefectForItem = (key: IssueKey): ListingDefect | undefined =>
    draft.defects.find((d) => d.id === key);

  const handleSelectCondition = (item: ConditionItemSpec, isIntact: boolean) => {
    setChecklist({ ...draft.checklist, [item.key]: isIntact });
    setError(null);

    if (isIntact) {
      // Remove defect record for this criterion when switched back to สมบูรณ์
      const existing = getDefectForItem(item.key);
      if (!isAdminDemoMode && existing?.photo) {
        void safeDeleteUploadedImage(existing.photo);
      }
      const remaining = draft.defects.filter((d) => d.id !== item.key);
      syncDefectsToDraft(remaining);
    } else {
      // Ensure a defect placeholder exists for this criterion
      const existing = getDefectForItem(item.key);
      if (!existing) {
        const nextDefects: ListingDefect[] = [
          ...draft.defects,
          {
            id: item.key,
            note: item.defectDefaultLabel,
            photo: undefined,
          },
        ];
        syncDefectsToDraft(nextDefects);
      }
    }
  };

  const handleDefectPhotoCaptured = (item: ConditionItemSpec, photoUrl: string) => {
    const existing = getDefectForItem(item.key);
    if (!isAdminDemoMode && existing?.photo && existing.photo !== photoUrl) {
      void safeDeleteUploadedImage(existing.photo);
    }
    const customNote = extractCustomNote(existing, item);
    const updatedDefect: ListingDefect = {
      id: item.key,
      note: buildDefectNote(item, customNote),
      photo: photoUrl,
    };
    const otherDefects = draft.defects.filter((d) => d.id !== item.key);
    syncDefectsToDraft([...otherDefects, updatedDefect]);
    setActiveCameraItem(null);
    setError(null);
  };

  const handleDefectNoteChange = (item: ConditionItemSpec, customNote: string) => {
    const existing = getDefectForItem(item.key);
    const updatedDefect: ListingDefect = {
      id: item.key,
      note: buildDefectNote(item, customNote),
      photo: existing?.photo,
    };
    const otherDefects = draft.defects.filter((d) => d.id !== item.key);
    syncDefectsToDraft([...otherDefects, updatedDefect]);
  };

  const defectiveItems = CONDITION_ITEMS.filter((item) => !draft.checklist[item.key]);

  const handleNext = () => {
    const missingPhotos = defectiveItems.filter((item) => {
      const defect = getDefectForItem(item.key);
      return !defect?.photo;
    });

    if (missingPhotos.length > 0) {
      setError(
        `กรุณาถ่ายรูปจุดที่มีตำหนิให้ครบก่อนไปต่อ: ${missingPhotos
          .map((item) => `ข้อ ${item.number} (${item.title})`)
          .join(', ')}`
      );
      return;
    }

    router.push('/seller/list/step-4');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="เช็กจุดตำหนิ 5 ข้อ" onBack={() => router.push('/seller/list/step-2')} />
      <Stepper currentStep={4} />

      {isAdminDemoMode && (
        <div className="px-4 pt-3">
          <AdminDemoBanner
            title="Admin Relist Demo · Dry-run"
            description="ผลเช็กสภาพ 5 จุดและรูปตำหนิถูกเติมให้แล้ว กดปรับให้เกรดเปลี่ยนโชว์ได้โดยไม่กระทบประกาศจริง"
          />
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* 4 Angle Photos Preview Strip */}
        {anglePhotos.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                รูปหนังสือ 4 มุมที่ถ่ายไว้
              </span>
              <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                <ZoomIn className="w-3 h-3" /> แตะที่รูปเพื่อซูมดู
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {anglePhotos.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setGalleryIndex(idx)}
                  className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-semibold py-0.5 text-center truncate px-1">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="px-1 space-y-2">
          <p className="text-xs font-bold text-slate-800">
            ตรวจสอบคุณภาพหนังสือทั้ง 5 จุด
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
            หากจุดใดเลือก <strong className="text-amber-700">มีตำหนิ</strong> ระบบจะให้ถ่ายรูปจุดที่มีตำหนินั้นเพื่อให้ผู้ซื้อซูมดูคุณภาพจริงได้อย่างโปร่งใส
          </p>
          {isSet && (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
              <strong>เกณฑ์สำหรับขายชุด:</strong> ให้คะแนนตามเล่มที่มีสภาพต่ำสุดในชุด และระบุเลขเล่มที่พบตำหนิในช่องอธิบายเพิ่มเติม
            </div>
          )}
        </div>

        {/* 5 Condition Check Items */}
        <div className="space-y-3">
          {CONDITION_ITEMS.map((item) => {
            const isGood = draft.checklist[item.key];
            const defect = getDefectForItem(item.key);
            const customNote = extractCustomNote(defect, item);

            return (
              <section
                key={item.key}
                className={clsx(
                  'bg-white rounded-2xl border p-3.5 transition-all space-y-3',
                  isGood
                    ? 'border-slate-200'
                    : defect?.photo
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-rose-300 bg-rose-50/20'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {item.number}. {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.goodDesc}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      isGood
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : defect?.photo
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                    )}
                  >
                    {isGood ? 'สมบูรณ์' : defect?.photo ? 'ถ่ายรูปตำหนิแล้ว' : 'รอถ่ายรูปตำหนิ *'}
                  </span>
                </div>

                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label={item.title}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isGood}
                    onClick={() => handleSelectCondition(item, true)}
                    className={clsx(
                      'min-h-[42px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition',
                      isGood
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" /> สมบูรณ์
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isGood}
                    onClick={() => handleSelectCondition(item, false)}
                    className={clsx(
                      'min-h-[42px] rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition',
                      !isGood
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    <AlertTriangle className="w-4 h-4" /> มีตำหนิ
                  </button>
                </div>

                {/* Expanded Defect Photo & Note Section when marked มีตำหนิ */}
                {!isGood && (
                  <div className="pt-2.5 border-t border-amber-200/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900">
                        รูปถ่ายจุดตำหนิ ({item.title}) <span className="text-rose-500">*</span>
                      </span>
                      {!defect?.photo && (
                        <span className="text-[10px] font-semibold text-rose-600">
                          บังคับถ่ายอย่างน้อย 1 รูป
                        </span>
                      )}
                    </div>

                    {defect?.photo ? (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-amber-200">
                        <img
                          src={defect.photo}
                          alt={item.title}
                          className="w-20 h-20 rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
                        />
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> แนบรูปตำหนิเรียบร้อย
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug">
                            ผู้ซื้อจะสามารถกดซูมดูรูปตำหนิจุดนี้ได้ในหน้ารายละเอียดสินค้า
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveCameraItem(item)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg transition"
                          >
                            <RefreshCcw className="w-3 h-3" /> ถ่ายใหม่ / เปลี่ยนรูป
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveCameraItem(item)}
                        className="w-full py-4 px-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/50 hover:bg-amber-50 flex flex-col items-center justify-center gap-1.5 transition"
                      >
                        <span className="w-10 h-10 rounded-full bg-white border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                          <Camera className="w-5 h-5" />
                        </span>
                        <span className="text-xs font-bold text-amber-900">
                          แตะเพื่อถ่ายรูปตำหนิ: {item.title}
                        </span>
                        <span className="text-[10px] text-amber-700">
                          ถ่ายให้เห็นบริเวณที่มีตำหนิชัดเจน
                        </span>
                      </button>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        อธิบายจุดตำหนิเพิ่มเติม (ไม่บังคับ)
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={customNote}
                        onChange={(e) => handleDefectNoteChange(item, e.target.value)}
                        placeholder={
                          isSet
                            ? 'เช่น เล่ม 3 มุมปกพับ, เล่ม 5 มีรอยไฮไลต์ 2 หน้า (ไม่บังคับ)'
                            : item.notePlaceholder
                        }
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#8B5E3C]"
                      />
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Auto-calculated Grade Summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">เกรดที่ระบบคำนวณจากผลตรวจ 5 ข้อ</span>
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
              จุดที่มีตำหนิ{' '}
              <strong className="text-slate-800">{defectiveItems.length}</strong> /{' '}
              {CONDITION_ITEMS.length} ข้อ
            </div>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
          >
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ถัดไป · ตั้งราคาและวิธีส่ง
          </Button>
        </div>
      </div>

      <CameraCapture
        isOpen={!!activeCameraItem}
        mode="PHOTO"
        title={activeCameraItem ? `ถ่ายจุดตำหนิ: ${activeCameraItem.title}` : ''}
        hint="ถ่ายใกล้ๆ ให้เห็นบริเวณที่มีตำหนิชัดเจน"
        demoImage={activeCameraItem?.demoPhoto}
        bucket="book-listings"
        deferUpload
        onClose={() => setActiveCameraItem(null)}
        onCapture={(url) => {
          if (!activeCameraItem) return;
          handleDefectPhotoCaptured(activeCameraItem, url);
        }}
      />

      <PhotoGallery
        isOpen={galleryIndex !== null}
        photos={anglePhotos}
        initialIndex={galleryIndex ?? 0}
        onClose={() => setGalleryIndex(null)}
      />

      <BottomSheet
        isOpen={isGradeSheetOpen}
        onClose={() => setIsGradeSheetOpen(false)}
        title="เกณฑ์การให้เกรด"
      >
        <div className="space-y-2 py-1">
          {GRADE_CRITERIA.map((c) => (
            <div
              key={c.grade}
              className={clsx(
                'p-3 rounded-xl border',
                c.grade === grade
                  ? 'border-[var(--color-primary)] bg-emerald-50'
                  : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  เกรด {c.grade} · {c.title}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {c.percent}% ของราคามือหนึ่ง
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{c.detail}</p>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 pt-1">
            นับจำนวนหัวข้อที่มีตำหนิจาก 5 ข้อ: ไม่มี = A · 1 ข้อ = B · 2 ข้อ = C · 3 ข้อขึ้นไป = D
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}
