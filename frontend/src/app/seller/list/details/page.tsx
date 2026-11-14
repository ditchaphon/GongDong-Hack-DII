'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Stepper } from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { BOOK_CATEGORIES } from '@/lib/catalog';
import { BookOpen, ChevronRight, Info, Lock } from 'lucide-react';

/** Step 2: book details + categories. ISBN metadata is locked once filled. */
export default function SellerListDetailsPage() {
  const router = useRouter();
  const { draft, update } = useListing();
  const isSet = draft.mode === 'SET';
  const hasIsbn = !!draft.isbn;
  // Lock only metadata fields that were pre-populated by ISBN lookup (don't lock missing fields or mid-typing)
  const [lockedFields] = useState(() => ({
    author: hasIsbn && !!draft.author,
    publisher: hasIsbn && !!draft.publisher,
    originalPrice: hasIsbn && draft.originalPrice > 0,
  }));

  const toggleCategory = (category: string) =>
    update({
      categories: draft.categories.includes(category)
        ? draft.categories.filter((item) => item !== category)
        : [...draft.categories, category],
    });

  const handleNext = () => {
    if (!draft.title.trim()) {
      return;
    }
    router.push('/seller/list/step-2');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="รายละเอียดหนังสือ" onBack={() => router.push('/seller/list')} />
      <Stepper currentStep={2} />

      <div className="p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ขั้นที่ 2 · รายละเอียดหนังสือ
            </h2>
            {hasIsbn && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Lock className="w-3 h-3" /> ISBN {draft.isbn}
              </span>
            )}
          </div>

          {hasIsbn && (lockedFields.author || lockedFields.publisher || lockedFields.originalPrice) && (
            <p className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ข้อมูลที่ได้จากเลข ISBN จะถูกล็อก · แก้ไขชื่อหนังสือและข้อมูลส่วนที่ยังว่างได้
            </p>
          )}

          <Input
            id="listing-title"
            label={isSet ? 'ชื่อชุดหนังสือ *' : 'ชื่อหนังสือ *'}
            placeholder="ชื่อหนังสือที่ต้องการลงขาย"
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="listing-author"
              label="ผู้แต่ง"
              placeholder="ชื่อผู้แต่ง"
              value={draft.author}
              disabled={lockedFields.author}
              onChange={(event) => update({ author: event.target.value })}
            />
            <Input
              id="listing-publisher"
              label="สำนักพิมพ์"
              placeholder="สำนักพิมพ์"
              value={draft.publisher}
              disabled={lockedFields.publisher}
              onChange={(event) => update({ publisher: event.target.value })}
            />
          </div>

          <Input
            id="listing-original-price"
            label="ราคาปก (บาท)"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={draft.originalPrice ? String(draft.originalPrice) : ''}
            disabled={lockedFields.originalPrice}
            onChange={(event) =>
              update({ originalPrice: Number(event.target.value) || 0 })
            }
            helperText="ใช้คำนวณราคาแนะนำในขั้นตอนสุดท้าย"
          />

          <div className="space-y-1.5">
            <label
              htmlFor="listing-description"
              className="text-xs font-semibold text-slate-700"
            >
              รายละเอียดเพิ่มเติม
            </label>
            <textarea
              id="listing-description"
              rows={4}
              maxLength={500}
              value={draft.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="สภาพหนังสือ จุดเด่น หรือหมายเหตุถึงผู้ซื้อ"
              className="w-full text-sm p-3 rounded-xl border border-slate-200 resize-none focus:outline-none focus:border-[#8B5E3C]"
            />
            <p className="text-[10px] text-slate-400 text-right">
              {draft.description.length}/500
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">
              หมวดหมู่ (เลือกได้หลายหมวด)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BOOK_CATEGORIES.map((category) => {
                const on = draft.categories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                      on
                        ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {!draft.title.trim() && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500 px-1">
            <BookOpen className="w-3.5 h-3.5" />
            กรอกชื่อหนังสือก่อนไปขั้นถ่ายรูป
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            disabled={!draft.title.trim()}
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ถัดไป · รูปถ่าย
          </Button>
        </div>
      </div>
    </div>
  );
}
