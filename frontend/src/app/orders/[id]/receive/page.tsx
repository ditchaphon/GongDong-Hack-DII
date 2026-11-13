'use client';

import React, { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { CameraCapture } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { Camera, Star, RefreshCcw, ShieldCheck } from 'lucide-react';

const TAGS = ['ตรงปก', 'แพ็กดี', 'ส่งไว', 'สภาพดีกว่าที่คิด', 'ผู้ขายตอบไว'];
const DEMO_PHOTO = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600';

/** Parcel step 4: buyer photographs the book, confirms, and reviews. */
export default function ReceiveParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { getOrder, confirmReceived } = useV4Orders();
  const order = getOrder(id);

  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [gradeMatched, setGradeMatched] = useState<boolean | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (
    !order ||
    (!done && !['PAID', 'SHIPPED', 'SCHEDULED'].includes(order.status))
  ) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ยืนยันรับของ" onBack={() => router.push(order ? `/orders/${order.id}` : '/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ออเดอร์นี้ยังไม่พร้อมยืนยันรับของ หรือยืนยันไปแล้ว</p>
      </div>
    );
  }

  const submit = () => {
    if (!photo) return setError('ถ่ายรูปหนังสือที่ได้รับก่อน');
    if (!rating) return setError('ให้คะแนนอย่างน้อย 1 ดาว');
    if (gradeMatched === null) return setError('บอกเราว่าสภาพหนังสือตรงเกรดไหม');
    setDone(true);
    confirmReceived(order.id, photo, { rating, isGradeMatched: gradeMatched, tags, comment: comment.trim() });
    setToast('ยืนยันรับของแล้ว · ชำระเงินปลายทางเรียบร้อย');
    setTimeout(() => router.push(`/orders/${order.id}`), 900);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <TopBar title="ได้รับของแล้ว" onBack={() => router.push(`/orders/${order.id}`)} />

      <div className="p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">1. ถ่ายรูปหนังสือที่ได้รับ</h2>
          <p className="text-[11px] text-slate-500">ใช้เป็นหลักฐานว่าได้รับของในสภาพไหน · ถ่ายจากกล้องหรือเลือกจากแกลอรี่</p>
          {photo ? (
            <div className="relative">
              <img src={photo} alt="รูปหนังสือที่ได้รับ" className="w-full h-52 object-cover rounded-xl bg-slate-100" />
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/60 text-white text-[11px] font-semibold"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> ถ่ายใหม่
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="w-full h-40 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 flex flex-col items-center justify-center gap-2 text-emerald-800"
            >
              <Camera className="w-7 h-7" />
              <span className="text-sm font-bold">เปิดกล้องถ่ายรูป</span>
            </button>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">2. ให้คะแนนและรีวิว</h2>
          <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="คะแนน">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ดาว`} onClick={() => setRating(n)}>
                <Star className={clsx('w-9 h-9 transition', n <= rating ? 'fill-amber-400 stroke-amber-400' : 'stroke-slate-300')} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, label: '✓ ตรงเกรด' },
              { v: false, label: '⚠ ไม่ตรงเกรด' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setGradeMatched(opt.v)}
                aria-pressed={gradeMatched === opt.v}
                className={clsx(
                  'min-h-[44px] rounded-xl border text-xs font-bold',
                  gradeMatched === opt.v
                    ? opt.v
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                      : 'bg-amber-50 border-amber-400 text-amber-800'
                    : 'border-slate-200 text-slate-600'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[11px] font-semibold border',
                  tags.includes(tag) ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'border-slate-200 text-slate-600'
                )}
              >
                {tag}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="เล่าให้ผู้ซื้อคนอื่นฟังหน่อย (ไม่บังคับ)"
            className="w-full text-sm p-3 rounded-xl border border-slate-200 resize-none focus:outline-none focus:border-[var(--color-primary)]"
          />
        </section>

        <p className="flex items-start gap-1.5 text-[11px] text-slate-500 px-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
          กดยืนยันหลังจ่ายเงินสด ฿{order.amount.toLocaleString()} ให้ผู้ขายแล้ว · ถ้าของมีปัญหาให้แจ้งปัญหาแทน
        </p>
        {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" onClick={submit}>
            ยืนยันได้รับของและส่งรีวิว
          </Button>
        </div>
      </div>

      <CameraCapture
        isOpen={cameraOpen}
        mode="PHOTO"
        title="ถ่ายรูปหนังสือที่ได้รับ"
        hint="ถ่ายให้เห็นปกและสภาพหนังสือชัดเจน"
        demoImage={DEMO_PHOTO}
        onClose={() => setCameraOpen(false)}
        onCapture={(url) => {
          setPhoto(url);
          setCameraOpen(false);
          setError(null);
        }}
      />
      <Toast isOpen={!!toast} onClose={() => setToast(null)} message={toast || ''} />
    </div>
  );
}
