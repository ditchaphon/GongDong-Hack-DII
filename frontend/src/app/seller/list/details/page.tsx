'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Stepper } from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { BOOK_CATEGORIES } from '@/lib/catalog';
import { countSetActualVolumes } from '@/lib/delivery';
import { getIsbnSourceMeta, getIsbnToneClasses } from '@/lib/isbnSource';
import { BookOpen, ChevronRight, Info, Lock } from 'lucide-react';

/** Step 2: book details + categories. ISBN metadata is locked once filled. */
export default function SellerListDetailsPage() {
  const router = useRouter();
  const { draft, update } = useListing();
  const isSet = draft.mode === 'SET';
  const actualVolumes = countSetActualVolumes({
    isSet,
    totalVolumes: draft.totalVolumes,
    missingVolumes: draft.missingVolumes,
  });
  const hasIsbn = !!draft.isbn;
  const sourceMeta = getIsbnSourceMeta(draft.isbnLookupSource, draft.isbnLookupMessage);
  const toneClasses = sourceMeta ? getIsbnToneClasses(sourceMeta.tone) : null;
  // Lock only metadata fields that were pre-populated by ISBN lookup (keep set total price editable)
  const [lockedFields] = useState(() => ({
    author: hasIsbn && !!draft.author,
    publisher: hasIsbn && !!draft.publisher,
    originalPrice: hasIsbn && draft.originalPrice > 0,
  }));
  const [singleBookOriginalPrice] = useState(() =>
    hasIsbn && draft.originalPrice > 0 ? draft.originalPrice : 0
  );

  const toggleCategory = (category: string) =>
    update({
      categories: draft.categories.includes(category)
        ? draft.categories.filter((item) => item !== category)
        : [...draft.categories, category],
    });

  const isOtherCategorySelected = draft.categories.includes('อื่น ๆ');

  const canProceed =
    !!draft.title.trim() &&
    (!isOtherCategorySelected || !!draft.customCategory.trim());

  const handleNext = () => {
    if (!canProceed) return;
    router.push('/seller/list/step-2');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="รายละเอียดหนังสือ" onBack={() => router.push('/seller/list')} />
      <Stepper currentStep={2} />

      <div className="p-4 space-y-4">
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ขั้นที่ 2 · รายละเอียดหนังสือ
            </h2>
            {hasIsbn && (
              <div className="flex flex-wrap items-center gap-1.5">
                {sourceMeta && toneClasses && (
                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClasses.badge}`}>
                    {sourceMeta.badgeLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Lock className="w-3 h-3" /> ISBN {draft.isbn}
                </span>
              </div>
            )}
          </div>

          {hasIsbn && sourceMeta && toneClasses && (
            <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${toneClasses.banner}`}>
              <p className="font-bold">{sourceMeta.title}</p>
              <p className="mt-0.5 opacity-90">{sourceMeta.description}</p>
            </div>
          )}

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
            label={isSet ? 'ราคามือหนึ่งทั้งชุด (บาท)' : 'ราคามือหนึ่ง (บาท)'}
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={draft.originalPrice ? String(draft.originalPrice) : ''}
            disabled={!isSet && lockedFields.originalPrice}
            onChange={(event) =>
              update({ originalPrice: Number(event.target.value) || 0 })
            }
            helperText={
              isSet
                ? `กรอกราคามือหนึ่งรวมของหนังสือทั้ง ${actualVolumes} เล่มเพื่อคำนวณราคาแนะนำ (ไม่จำเป็นต้องใส่)`
                : 'ใช้คำนวณราคาแนะนำในขั้นตอนสุดท้าย ไม่จำเป็นต้องใส่'
            }
          />

          {isSet && singleBookOriginalPrice > 0 && (
            <button
              type="button"
              onClick={() => update({ originalPrice: singleBookOriginalPrice * actualVolumes })}
              className="w-full text-left px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-[11px] font-semibold text-purple-800 hover:bg-purple-100/70 transition"
            >
              ราคาปกเล่มเดียว ฿{singleBookOriginalPrice.toLocaleString()} → แตะเพื่อใช้ราคารวม {actualVolumes} เล่ม (฿{(singleBookOriginalPrice * actualVolumes).toLocaleString()})
            </button>
          )}

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
              placeholder="คุณภาพหนังสือ จุดเด่น หรือหมายเหตุถึงผู้ซื้อ"
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
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border ${on
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

            {isOtherCategorySelected && (
              <Input
                id="listing-custom-category"
                label="ระบุหมวดหมู่อื่น ๆ *"
                placeholder="เช่น ศาสนา, จิตวิทยา, ท่องเที่ยว"
                value={draft.customCategory}
                maxLength={40}
                onChange={(event) => update({ customCategory: event.target.value })}
                helperText="ชื่อหมวดนี้จะแสดงบนประกาศของคุณ"
              />
            )}
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
            disabled={!canProceed}
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
