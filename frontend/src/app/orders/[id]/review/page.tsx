'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { MOCK_ORDERS } from '@/mocks/books';
import { Star, CheckCircle2, Heart } from 'lucide-react';

export default function OrderReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const order = MOCK_ORDERS.find((o) => o.id === resolvedParams.id) || MOCK_ORDERS[0];

  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['สภาพตรงปกเป๊ะ']);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tags = [
    'สภาพตรงปกเป๊ะ 📖',
    'นัดรับตรงเวลา ⏱️',
    'แพ็คของดีมาก 📦',
    'ผู้ขายน่ารัก 💬',
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    setToastMessage(`ให้คะแนน ${rating} ดาวเรียบร้อยแล้ว (TRATE) ⭐`);
    setTimeout(() => {
      router.push('/');
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white select-none justify-between pb-6">
      <div>
        <TopBar title="ให้คะแนนผู้ขาย (B8)" />

        <div className="p-6 space-y-6 text-center">
          {/* Success Banner */}
          <div className="flex flex-col items-center space-y-2 pt-2">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#06C755] flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              การซื้อสำเร็จแล้ว!
            </h1>
            <p className="text-xs text-slate-500 max-w-xs">
              ขอบคุณที่ร่วมสร้างชุมชนนักอ่านที่ไว้วางใจได้ ช่วยให้คะแนนร้านค้าเพื่อสะสมคะแนนความน่าเชื่อถือ
            </p>
          </div>

          {/* Star selector */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <span className="text-xs font-semibold text-slate-600">
              ความพึงพอใจโดยรวม
            </span>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 transition active:scale-125"
                >
                  <Star
                    className={`w-9 h-9 ${
                      star <= rating
                        ? 'fill-amber-400 stroke-amber-400'
                        : 'stroke-slate-300 fill-transparent'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm font-bold text-amber-600 block">
              {rating === 5
                ? 'ยอดเยี่ยมมาก! ⭐⭐⭐⭐⭐'
                : rating === 4
                ? 'ดีมาก ⭐⭐⭐⭐'
                : 'พอใช้ ⭐⭐⭐'}
            </span>
          </div>

          {/* Preset compliments tags */}
          <div className="space-y-2 text-left">
            <span className="text-xs font-semibold text-slate-600">จุดเด่นที่ประทับใจ</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    selectedTags.includes(t)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Comment text */}
          <div className="space-y-1.5 text-left">
            <span className="text-xs font-semibold text-slate-600">
              ความคิดเห็นเพิ่มเติม (ถ้ามี)
            </span>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="เขียนความประทับใจถึงผู้ขาย..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#06C755]"
            />
          </div>
        </div>
      </div>

      <div className="px-6 safe-area-bottom">
        <Button fullWidth size="lg" onClick={handleSubmit}>
          ส่งคะแนนรีวิว
        </Button>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}

