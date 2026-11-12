'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { SELLER_MEETUP_ZONES } from '@/mocks/seller';
import { findContactLeaks } from '@/lib/masking';
import {
  Store,
  Truck,
  MapPin,
  Check,
  Info,
  Sparkles,
} from 'lucide-react';

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120',
];

export default function ShopSetupPage() {
  const router = useRouter();
  const { shop, saveShop } = useSeller();

  const [shopName, setShopName] = useState(shop?.shopName || '');
  const [avatar, setAvatar] = useState(shop?.avatar || AVATARS[0]);
  const [zones, setZones] = useState<string[]>(
    shop?.meetupZones?.length ? shop.meetupZones : [SELLER_MEETUP_ZONES[0]]
  );
  const [supportsParcel, setSupportsParcel] = useState(shop?.supportsParcel ?? false);
  const [parcelFee, setParcelFee] = useState(shop?.parcelFee || 40);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toggleZone = (zone: string) => {
    setZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
    setError(null);
  };

  const handleSave = () => {
    const clean = shopName.trim();
    if (clean.length < 2) {
      setError('ตั้งชื่อร้านอย่างน้อย 2 ตัวอักษร');
      return;
    }
    if (findContactLeaks(clean).length > 0) {
      setError('ชื่อร้านห้ามมีเบอร์โทร ไลน์ หรือช่องทางติดต่อ');
      return;
    }
    if (zones.length === 0) {
      setError('เลือกจุดนัดรับอย่างน้อย 1 จุด');
      return;
    }
    setError(null);
    saveShop({
      shopName: clean,
      avatar,
      meetupZones: zones,
      supportsParcel,
      parcelFee: supportsParcel ? Number(parcelFee) || 40 : 0,
    });
    setToastMessage('บันทึกข้อมูลร้านแล้ว');
    setTimeout(() => router.push('/seller'), 500);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title={shop?.setupComplete ? 'แก้ไขข้อมูลร้าน' : 'เปิดร้าน'}
        onBack={() => router.push('/seller')}
      />

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[var(--color-primary-dark)]" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              {shop?.setupComplete ? 'ร้านของคุณ' : 'เปิดร้านใช้เวลาประมาณ 1 นาที'}
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              ลงขายฟรี · ผู้ซื้อเห็นแค่ชื่อร้านกับรูปนี้ · ไม่ต้องกรอกชื่อจริง
              เบอร์โทร หรือบัญชีธนาคารตอนนี้
            </p>
          </div>
        </div>

        {/* Shop identity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Store className="w-4 h-4 text-[var(--color-primary)]" />
            ชื่อร้านและรูป
          </div>

          <Input
            label="ชื่อร้าน *"
            placeholder="เช่น ป้าหนอนหนังสือ"
            value={shopName}
            onChange={(event) => {
              setShopName(event.target.value);
              setError(null);
            }}
            helperText="ชื่อนี้แสดงให้ผู้ซื้อเห็น · ห้ามใส่เบอร์โทรหรือไลน์"
          />

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">รูปโปรไฟล์ร้าน</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {AVATARS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setAvatar(url)}
                  aria-label="เลือกรูปโปรไฟล์"
                  className={`relative w-14 h-14 rounded-full overflow-hidden border-2 shrink-0 transition ${
                    avatar === url
                      ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                      : 'border-slate-200 opacity-70'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {avatar === url && (
                    <span className="absolute inset-0 bg-emerald-600/25 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white stroke-[3]" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Meetup zones */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <MapPin className="w-4 h-4 text-teal-600" />
            จุดนัดรับใน มช. *
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            เลือกจุดที่สะดวก ผู้ซื้อจะเห็นเฉพาะจุดเหล่านี้ และยืนยันเวลากันในแชทออเดอร์
          </p>
          <div className="flex flex-wrap gap-2">
            {SELLER_MEETUP_ZONES.map((zone) => {
              const selected = zones.includes(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => toggleZone(zone)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                    selected
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  {selected ? '✓ ' : ''}
                  {zone}
                </button>
              );
            })}
          </div>
        </div>

        {/* Parcel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Truck className="w-4 h-4 text-slate-500" />
              รับส่งพัสดุ
            </div>
            <button
              type="button"
              onClick={() => setSupportsParcel((prev) => !prev)}
              aria-pressed={supportsParcel}
              aria-label="เปิดรับส่งพัสดุ"
              className={`w-10 h-6 rounded-full p-0.5 transition ${
                supportsParcel ? 'bg-[var(--color-primary)]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-white rounded-full shadow transition ${
                  supportsParcel ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {supportsParcel ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label htmlFor="shop-parcel-fee" className="text-xs text-slate-600">
                  ค่าส่งเล่มแรก
                </label>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-slate-400">฿</span>
                  <input
                    id="shop-parcel-fee"
                    type="number"
                    min={0}
                    value={parcelFee}
                    onChange={(event) => setParcelFee(Number(event.target.value) || 0)}
                    className="w-20 min-h-[38px] px-2 text-sm text-right bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                เล่มถัดไปในร้านเดียวกัน +฿10 ต่อเล่ม
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ปิดอยู่ · ร้านจะรับเฉพาะนัดรับและจ่ายเงินสดก่อน
              เปิดได้ทุกเมื่อเมื่อพร้อมส่งพัสดุ
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          ชื่อจริงและบัญชีรับเงินจะขอตอน “เติมเครดิตครั้งแรก” เท่านั้น
          และใช้เฉพาะฝั่งแอดมิน ผู้ซื้อไม่มีทางเห็น
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" onClick={handleSave}>
            {shop?.setupComplete ? 'บันทึกการแก้ไข' : 'เปิดร้านและเริ่มลงขาย'}
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
