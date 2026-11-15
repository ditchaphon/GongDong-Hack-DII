'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Stepper } from '@/components/ui';
import { CameraCapture } from '@/components/v4';
import { useListing } from '@/hooks/useListing';
import { Camera, Check, RefreshCcw, ChevronRight, ShieldCheck } from 'lucide-react';

type SlotKey = 'cover' | 'back' | 'spine' | 'inner';

// Prototype fallback when the device has no camera (e.g. desktop preview).
const DEMO: Record<SlotKey, string> = {
  cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
  back: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600',
  spine: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600',
  inner: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
};

export default function SellerListStep2Page() {
  const router = useRouter();
  const { draft, setPhoto } = useListing();
  const isSet = draft.mode === 'SET';

  const slots: { key: SlotKey; label: string; hint: string }[] = [
    { key: 'cover', label: isSet ? 'ปกหน้าทั้งชุด' : 'ปกหน้า', hint: 'ถ่ายตรง เห็นขอบครบ 4 ด้าน' },
    { key: 'back', label: 'ปกหลัง', hint: 'เห็นบาร์โค้ดและรอยถลอก' },
    { key: 'spine', label: isSet ? 'สันทุกเล่ม' : 'สันหนังสือ', hint: 'เห็นความหนาและรอยย่น' },
    { key: 'inner', label: 'หน้าด้านใน', hint: 'เปิดกลางเล่ม เห็นสีกระดาษ' },
  ];

  const [camera, setCamera] = useState<{ key: SlotKey; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const photoOf = (key: SlotKey) => (key === 'inner' ? draft.photos.inner : draft.photos[key]);
  const taken = slots.filter((slot) => !!photoOf(slot.key)).length;

  const handleNext = () => {
    if (taken < slots.length) {
      setError(`เพิ่มรูปให้ครบ ${slots.length} มุมก่อน (มีแล้ว ${taken})`);
      return;
    }
    router.push('/seller/list/step-3');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ถ่ายรูปหนังสือ" onBack={() => router.push('/seller/list/details')} />
      <Stepper currentStep={3} />

      <div className="p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">เพิ่มรูปหนังสือ {slots.length} มุม</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                ถ่ายจากกล้องหรือเลือกจากแกลอรี่ · ให้เห็นสภาพจริง · ขั้นต่อไปจะใช้รูปเหล่านี้ตรวจสภาพ
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
              {taken}/{slots.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {slots.map((slot) => {
              const url = photoOf(slot.key);
              return (
                <button
                  key={slot.key}
                  type="button"
                  onClick={() => setCamera({ key: slot.key, label: slot.label })}
                  className="text-left"
                  aria-label={url ? `เปลี่ยนรูป: ${slot.label}` : `เพิ่มรูป: ${slot.label}`}
                >
                  <span className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                    {slot.label} <span className="text-rose-500">*</span>
                  </span>
                  <span className="relative block aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50">
                    {url ? (
                      <>
                        <img src={url} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                        <span className="absolute bottom-0 inset-x-0 py-1.5 bg-black/55 text-white text-[10px] font-semibold flex items-center justify-center gap-1">
                          <RefreshCcw className="w-3 h-3" /> เปลี่ยนรูป
                        </span>
                      </>
                    ) : (
                      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                        <span className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-slate-600" />
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">แตะเพื่อถ่าย/แกลอรี่</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{slot.hint}</span>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
            ถ่ายจากกล้องหรือเลือกจากแกลอรี่ได้ · โปรดใช้รูปหนังสือเล่มจริงของคุณ
          </p>
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
            ถัดไป · ตรวจสภาพจากรูป
          </Button>
        </div>
      </div>

      <CameraCapture
        isOpen={!!camera}
        mode="PHOTO"
        title={camera ? `ถ่าย${camera.label}` : ''}
        hint="ถือกล้องให้นิ่ง เห็นหนังสือเต็มกรอบ"
        demoImage={camera ? DEMO[camera.key] : undefined}
        onClose={() => setCamera(null)}
        onCapture={(url) => {
          if (!camera) return;
          setPhoto(camera.key, url);
          setCamera(null);
          setError(null);
        }}
      />
    </div>
  );
}
