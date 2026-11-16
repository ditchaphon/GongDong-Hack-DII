'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { useV4Orders } from '@/hooks/useV4Orders';
import { Star, CheckCircle2, ShieldCheck } from 'lucide-react';

const TAGS = ['คุณภาพตรงเกรด', 'นัดตรงเวลา', 'แพ็กดี', 'คุยง่าย'];

export default function OrderReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, fetchOrder, loading, submitReview } = useV4Orders();

  const order = getOrder(resolvedParams.id);

  useEffect(() => {
    if (!order) fetchOrder(resolvedParams.id);
  }, [resolvedParams.id, order, fetchOrder]);

  const [rating, setRating] = useState(order?.review?.rating || 5);
  const [gradeMatched, setGradeMatched] = useState<boolean | null>(
    order?.review?.isGradeMatched ?? null
  );
  const [tags, setTags] = useState<string[]>(order?.review?.tags || []);
  const [comment, setComment] = useState(order?.review?.comment || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (order?.review) {
      setRating(order.review.rating);
      setGradeMatched(order.review.isGradeMatched);
      setTags(order.review.tags);
      setComment(order.review.comment);
    }
  }, [order?.review]);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ให้คะแนน" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">
          {loading ? 'กำลังโหลดข้อมูลออเดอร์...' : 'ไม่พบออเดอร์นี้'}
        </p>
      </div>
    );
  }

  const toggleTag = (tag: string) =>
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );

  const handleSubmit = async () => {
    if (gradeMatched === null) {
      setError('กรุณาตอบว่าคุณภาพหนังสือตรงเกรดที่ร้านแจ้งไว้หรือไม่');
      return;
    }
    setError(null);
    setSubmitting(true);
    const res = await submitReview(order.id, {
      rating,
      isGradeMatched: gradeMatched,
      tags,
      comment: comment.trim(),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || 'ส่งรีวิวไม่สำเร็จ');
      return;
    }
    setToastMessage('ส่งคะแนนรีวิวแล้ว · ขอบคุณที่ช่วยให้ชุมชนน่าเชื่อถือขึ้น');
    setTimeout(() => router.push(`/orders/${order.id}`), 1000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white select-none pb-28">
      <TopBar title="ให้คะแนนร้าน" onBack={() => router.push(`/orders/${order.id}`)} />

      <div className="p-5 space-y-5">
        <div className="text-center space-y-2 pt-1">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-[var(--color-primary)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">ออเดอร์สำเร็จแล้ว</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            ให้คะแนนร้าน {order.shop.shopName} · รีวิวจะช่วยให้คนอื่นตัดสินใจได้ดีขึ้น
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
          <span className="text-xs font-semibold text-slate-600">ความพึงพอใจโดยรวม</span>
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`${star} ดาว`}
                className="p-1 active:scale-125 transition"
              >
                <Star
                  className={`w-8 h-8 ${star <= rating
                      ? 'fill-amber-400 stroke-amber-400'
                      : 'stroke-slate-300 fill-transparent'
                    }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs font-bold text-amber-600">
            {rating} ดาว
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-600">
            คุณภาพหนังสือตรงกับเกรดที่แจ้งไหม?
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setGradeMatched(true);
                setError(null);
              }}
              className={`p-3 rounded-xl border text-xs font-bold ${gradeMatched === true
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 text-slate-600'
                }`}
            >
              ตรงเกรด
            </button>
            <button
              type="button"
              onClick={() => {
                setGradeMatched(false);
                setError(null);
              }}
              className={`p-3 rounded-xl border text-xs font-bold ${gradeMatched === false
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 text-slate-600'
                }`}
            >
              ไม่ตรงเกรด
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-600">จุดเด่นที่ประทับใจ</span>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${tags.includes(tag)
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                    : 'bg-white border-slate-200 text-slate-600'
                  }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="review-comment" className="text-xs font-semibold text-slate-600">
            ความคิดเห็นเพิ่มเติม (ถ้ามี)
          </label>
          <textarea
            id="review-comment"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="เขียนถึงร้านนี้..."
            className="w-full text-xs p-3 rounded-xl border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        <p className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          รีวิวจะแสดงโดยใช้ชื่อเล่นของคุณ
        </p>

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
            onClick={handleSubmit}
            disabled={submitting || !!order.review}
          >
            {order.review
              ? 'รีวิวเรียบร้อยแล้ว'
              : submitting
                ? 'กำลังส่งคะแนนรีวิว...'
                : 'ส่งคะแนนรีวิว'}
          </Button>
        </div>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
