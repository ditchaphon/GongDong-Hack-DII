'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  BottomSheet,
  PhotoUploader,
  Stepper,
  Toast,
} from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { useLiff } from '@/hooks/useLiff';
import {
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
  'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600',
];

const DEFECT_AREAS = [
  'สันหนังสือ',
  'รอยเปื้อน',
  'รอยขีดเขียน',
  'ปกหน้า-หลัง',
  'หน้ากระดาษ',
];

export default function SellerListStep2Page() {
  const router = useRouter();
  const { draft, update, setPhoto, addDefect, removeDefect } = useListing();
  const { isMock } = useLiff();

  const isSet = draft.mode === 'SET';

  const [isDefectOpen, setIsDefectOpen] = useState(false);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [defectArea, setDefectArea] = useState(DEFECT_AREAS[0]);
  const [defectNote, setDefectNote] = useState('');
  const [defectPhoto, setDefectPhoto] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requiredPhotos = [
    { key: 'cover' as const, label: isSet ? 'รูปหน้าปกทั้งชุด' : 'รูปปกหน้า' },
    { key: 'back' as const, label: 'รูปปกหลัง' },
    { key: 'spine' as const, label: isSet ? 'รูปสันหนังสือทุกเล่ม' : 'รูปสันหนังสือ' },
    { key: 'nameTag' as const, label: 'รูปป้ายชื่อ + หนังสือ' },
  ];

  const missing = requiredPhotos.some((p) => !draft.photos[p.key]);

  const fillSamplePhotos = () => {
    setPhoto('cover', SAMPLE_PHOTOS[0]);
    setPhoto('back', SAMPLE_PHOTOS[1]);
    setPhoto('spine', SAMPLE_PHOTOS[2]);
    setPhoto('nameTag', SAMPLE_PHOTOS[3]);
    setToastMessage('เติมรูปตัวอย่างครบ 4 รูปแล้ว');
  };

  const handleNext = () => {
    if (missing) {
      setError('ต้องมีรูปครบทั้ง 4 รูป รวมรูปป้ายชื่อจริงก่อนไปขั้นตอนต่อไป');
      return;
    }
    setError(null);
    router.push('/seller/list/step-3');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ถ่ายรูปหนังสือ" onBack={() => router.push('/seller/list')} />

      <Stepper currentStep={2} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {isSet ? 'ขั้นที่ 2 · รูปถ่ายทั้งชุด (S3PB)' : 'ขั้นที่ 2 · รูปถ่าย 4 รูป (S3P)'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                ถ่ายในที่แสงธรรมชาติ เห็นตำหนิชัดเจน ห้ามใช้รูปจากอินเทอร์เน็ต
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
              บังคับ 4 รูป
            </span>
          </div>

          {isMock && (
            <button
              type="button"
              onClick={fillSamplePhotos}
              className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              เติมรูปตัวอย่าง 4 รูป (โหมดจำลอง)
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            {requiredPhotos.map((p) => (
              <PhotoUploader
                key={p.key}
                label={p.label}
                isRequired
                isNameTag={p.key === 'nameTag'}
                previewUrl={draft.photos[p.key]}
                onChange={(url) => setPhoto(p.key, url)}
                onRemove={() => setPhoto(p.key, '')}
                description={
                  p.key === 'nameTag'
                    ? 'เขียนชื่อ LINE + วันที่ วางคู่กับหนังสือ'
                    : p.key === 'spine'
                    ? 'ถ่ายตรง เห็นสันและความหนา'
                    : 'ถ่ายตรง เห็นขอบทั้ง 4 ด้าน'
                }
              />
            ))}
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              รูปป้ายชื่อเป็นหลักฐานว่าคุณถือหนังสือจริง ผู้ซื้อใช้ตรวจก่อนตัดสินใจ
              และใช้เทียบตอนนัดรับ
            </span>
          </div>
        </div>

        {/* Defects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              รูปตำหนิ (ถ้ามี)
            </h3>
            <span className="text-[11px] text-slate-400">
              {draft.defects.length} รายการ
            </span>
          </div>

          {draft.defects.length > 0 ? (
            <div className="space-y-2">
              {draft.defects.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200"
                >
                  {d.photo ? (
                    <img
                      src={d.photo}
                      alt={d.note}
                      className="w-12 h-12 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{d.note}</p>
                    <p className="text-[11px] text-slate-400">แนบรูปตำหนิแล้ว</p>
                  </div>
                  <button
                    type="button"
                    aria-label="ลบตำหนิ"
                    onClick={() => removeDefect(d.id)}
                    className="p-2 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 leading-relaxed">
              ถ้าหนังสือมีรอยฉีก คราบน้ำ หรือรอยเขียน ให้ถ่ายรูปและอธิบายสั้น ๆ
              เพื่อไม่ให้ผู้ซื้อเข้าใจผิด
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            fullWidth
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsDefectOpen(true)}
          >
            เพิ่มรูปตำหนิ
          </Button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
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
            ถัดไป · ตรวจสภาพ 5 จุด
          </Button>
        </div>
      </div>

      {/* DEFECT — describe defect + photo */}
      <BottomSheet
        isOpen={isDefectOpen}
        onClose={() => setIsDefectOpen(false)}
        title="อธิบายตำหนิ (DEFECT)"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!defectNote.trim()}
            onClick={() => {
              addDefect({
                id: `defect-${Date.now()}`,
                note: `${defectArea} · ${defectNote.trim()}`,
                photo: defectPhoto || undefined,
              });
              setIsDefectOpen(false);
              setDefectNote('');
              setDefectPhoto('');
              setToastMessage('เพิ่มตำหนิแล้ว');
            }}
          >
            บันทึกตำหนิ
          </Button>
        }
      >
        <div className="space-y-3 py-1">
          <div>
            <span className="text-xs font-semibold text-slate-700">ตำแหน่งที่มีตำหนิ</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {DEFECT_AREAS.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setDefectArea(area)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    defectArea === area
                      ? 'bg-[#06C755] border-[#06C755] text-white'
                      : 'bg-slate-100 border-transparent text-slate-600'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="defect-note" className="text-xs font-semibold text-slate-700">
              อธิบายตำหนิ
            </label>
            <textarea
              id="defect-note"
              rows={3}
              value={defectNote}
              onChange={(e) => setDefectNote(e.target.value)}
              placeholder="เช่น มีรอยปากกาที่หน้า 12 ยาวประมาณ 2 ซม."
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsPhotoOpen(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left"
          >
            {defectPhoto ? (
              <img
                src={defectPhoto}
                alt="รูปตำหนิ"
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                <Camera className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-800">
                {defectPhoto ? 'เปลี่ยนรูปตำหนิ' : 'แนบรูปตำหนิ'}
              </div>
              <div className="text-[11px] text-slate-400">ถ่ายใกล้ เห็นรอยชัดเจน</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </BottomSheet>

      {/* PHOTO — choose photo source (system-like sheet) */}
      <BottomSheet
        isOpen={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        title="เพิ่มรูปภาพ (PHOTO)"
      >
        <div className="space-y-2 py-1">
          <button
            type="button"
            onClick={() => {
              setDefectPhoto(SAMPLE_PHOTOS[1]);
              setIsPhotoOpen(false);
              setToastMessage('แนบรูปตำหนิแล้ว (TPHOTO)');
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-800"
          >
            <Camera className="w-5 h-5 text-[#06C755]" />
            ถ่ายรูปใหม่
          </button>
          <button
            type="button"
            onClick={() => {
              setDefectPhoto(SAMPLE_PHOTOS[2]);
              setIsPhotoOpen(false);
              setToastMessage('แนบรูปตำหนิแล้ว (TPHOTO)');
            }}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-sm font-medium text-slate-800"
          >
            <ImageIcon className="w-5 h-5 text-sky-600" />
            เลือกจากอัลบั้ม
          </button>
          <button
            type="button"
            onClick={() => setIsPhotoOpen(false)}
            className="w-full p-3.5 text-sm text-slate-500"
          >
            ยกเลิก
          </button>
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
