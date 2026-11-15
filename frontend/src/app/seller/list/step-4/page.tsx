'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  GradeBadge,
  PriceSuggest,
  Stepper,
  Toast,
} from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { useSeller } from '@/hooks/useSeller';
import {
  MapPin,
  Truck,
  Check,
  ChevronRight,
  Layers,
  Info,
} from 'lucide-react';

export default function SellerListStep4Page() {
  const router = useRouter();
  const { draft, grade, update, toggleDelivery } = useListing();
  const { publishListing, shop } = useSeller();

  const isSet = draft.mode === 'SET';
  const canParcel = shop?.payeeVerified ?? false;
  const hasMeetup = draft.deliveryMethods.includes('MEETUP');
  const hasParcel = draft.deliveryMethods.includes('PARCEL') && canParcel;

  const [priceInput, setPriceInput] = useState(draft.price ? String(draft.price) : '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const price = Number(priceInput) || 0;
  const pointCount = shop?.meetupPoints.length ?? 0;

  const handlePublish = () => {
    if (price < 1) {
      setError('กรุณาตั้งราคาขายอย่างน้อย ฿1');
      return;
    }
    if (!hasMeetup && !hasParcel) {
      setError('เลือกวิธีรับหนังสืออย่างน้อย 1 วิธี');
      return;
    }
    setError(null);
    update({ price });
    publishListing({ ...draft, price });
    router.push('/seller/list/success');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ตั้งราคาและวิธีรับ" onBack={() => router.push('/seller/list/step-3')} />

      <Stepper currentStep={5} />

      <div className="p-4 space-y-4">
        {/* Price */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isSet ? 'ขั้นที่ 5 · ราคาขายทั้งชุด' : 'ขั้นที่ 5 · ราคาขาย'}
            </h3>
            <GradeBadge grade={grade} size="sm" />
          </div>

          <div className="flex items-center gap-2 w-full">
            <span className="text-2xl font-black text-slate-300 shrink-0 select-none">฿</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={priceInput}
              onChange={(e) => {
                setPriceInput(e.target.value);
                setError(null);
              }}
              placeholder="0"
              aria-label="ราคาขาย"
              className="flex-1 min-w-0 w-full min-h-[52px] px-3 text-2xl font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-[#8B5E3C] focus:ring-2 focus:ring-[#8B5E3C]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {isSet && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <Layers className="w-3.5 h-3.5" />
              ขายยกชุด {draft.totalVolumes} เล่ม
              {draft.missingVolumes.length > 0 &&
                ` · ขาดเล่ม ${draft.missingVolumes.join(', ')}`}
            </div>
          )}

          {draft.originalPrice > 0 && (
            <PriceSuggest
              originalPrice={draft.originalPrice}
              grade={grade}
              currentPrice={price}
              onApplyPrice={(suggested) => {
                setPriceInput(String(suggested));
                update({ price: suggested });
                setToastMessage('ใช้ราคาแนะนำแล้ว (TPRICE)');
              }}
            />
          )}

          {draft.originalPrice === 0 && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ไม่มีราคามือหนึ่งของเล่มนี้ ระบบจึงยังไม่แสดงราคาแนะนำ
              ตั้งราคาตามสภาพที่คุณประเมินได้เลย
            </p>
          )}
        </div>

        {/* Delivery options */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            วิธีส่งหนังสือ
          </h3>

          <button
            type="button"
            onClick={() => toggleDelivery('MEETUP')}
            className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition ${
              hasMeetup
                ? 'border-[#8B5E3C] bg-emerald-50/50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <span
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                hasMeetup
                  ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                  : 'bg-white border-slate-300'
              }`}
            >
              {hasMeetup && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <MapPin className="w-4 h-4 text-teal-600" />
                นัดรับ
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                ผู้ซื้อเลือกจากจุดนัดของร้าน ({pointCount} จุด) · ตรวจหนังสือก่อนจ่ายเงินสด
              </span>
            </span>
            <span className="text-xs font-bold text-emerald-700">ฟรี</span>
          </button>

          <button
            type="button"
            disabled={!canParcel}
            onClick={() => toggleDelivery('PARCEL')}
            className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border text-left transition ${
              hasParcel
                ? 'border-[#8B5E3C] bg-emerald-50/50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            } ${!canParcel ? 'opacity-50' : ''}`}
          >
            <span
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                hasParcel
                  ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                  : 'bg-white border-slate-300'
              }`}
            >
              {hasParcel && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <Truck className="w-4 h-4 text-slate-500" />
                ส่งพัสดุ
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                {canParcel
                  ? 'ค่าส่งแยกจากค่าหนังสือ · เก็บเงินปลายทางเมื่อรับพัสดุ'
                  : 'ต้องยืนยันตัวตน (KYC) ก่อนเปิดส่งพัสดุ'}
              </span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">ระบบคำนวณ</span>
          </button>

          {!canParcel && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ร้านที่ยังไม่ยืนยันตัวตนรับได้เฉพาะนัดรับ · ยืนยันได้ในตั้งค่าร้าน
            </div>
          )}

        </div>

        {/* Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1">
            สรุปการลงขาย
          </h3>
          <div className="flex justify-between text-slate-500">
            <span>ค่าหนังสือ</span>
            <span className="font-semibold text-slate-800">฿{price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ค่าส่ง</span>
            <span className="font-semibold text-slate-800">แยกจากค่าหนังสือ · ตกลงกันเอง</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-900">คุณได้รับ</span>
            <span className="text-lg font-black text-[#8B5E3C]">
              ฿{price.toLocaleString()}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">
            ลงขายฟรี · จะใช้ 1 เครดิตก็ต่อเมื่อคุณกดรับออเดอร์เท่านั้น
          </p>
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
            onClick={handlePublish}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ลงประกาศขาย
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
