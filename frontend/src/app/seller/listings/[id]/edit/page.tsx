'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, GradeBadge, Toast } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { useV4Orders } from '@/hooks/useV4Orders';
import {
  MapPin,
  Truck,
  Check,
  EyeOff,
  Eye,
  Info,
} from 'lucide-react';

export default function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { listings, shop, updateListing, setListingStatus } = useSeller();
  const { orders, isMineAsBuyer } = useV4Orders();

  const listing = listings.find((item) => item.id === resolvedParams.id);
  const canParcel = Boolean(shop?.payeeVerified && shop?.supportsParcel);
  const hasActiveOrder = listing
    ? orders.some(
        (order) =>
          !isMineAsBuyer(order) &&
          ['REQUESTED', 'ACCEPTED', 'PAID', 'SHIPPED', 'SCHEDULED'].includes(order.status) &&
          order.books.some((book) => book.id === listing.id)
      )
    : false;

  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [price, setPrice] = useState(listing ? String(listing.price) : '');
  const [meetup, setMeetup] = useState(listing?.deliveryMethods.includes('MEETUP') ?? true);
  const [parcel, setParcel] = useState(listing?.deliveryMethods.includes('PARCEL') ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (listing && hydratedId !== listing.id) {
      setPrice(String(listing.price));
      setMeetup(listing.deliveryMethods.includes('MEETUP'));
      setParcel(listing.deliveryMethods.includes('PARCEL'));
      setHydratedId(listing.id);
    }
  }, [listing, hydratedId]);

  if (!listing) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="แก้ไขประกาศ" onBack={() => router.push('/seller')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบประกาศนี้</p>
      </div>
    );
  }

  const locked = listing.status === 'WAITING_PAYMENT' || hasActiveOrder;

  const handleSave = async () => {
    if (locked) {
      setError('ออเดอร์นี้ถูกยืนยันแล้ว · แก้ไขประกาศไม่ได้จนกว่าจะปิดออเดอร์');
      return;
    }
    const nextPrice = Number(price) || 0;
    if (nextPrice < 1) {
      setError('กรุณาตั้งราคาอย่างน้อย ฿1');
      return;
    }
    if (!meetup && !parcel) {
      setError('เลือกวิธีรับอย่างน้อย 1 วิธี');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateListing(listing.id, {
        price: nextPrice,
        deliveryMethods: [
          ...(meetup ? (['MEETUP'] as const) : []),
          ...(parcel ? (['PARCEL'] as const) : []),
        ],
        parcelShippingFee: undefined,
      });
      setToastMessage('บันทึกการแก้ไขแล้ว');
      setTimeout(() => router.push('/seller'), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="แก้ไขประกาศ" onBack={() => router.push('/seller')} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex gap-3">
          <img
            src={listing.photos.cover}
            alt={listing.title}
            className="w-14 h-20 rounded-xl object-cover bg-slate-100 shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
              {listing.title}
            </h1>
            <p className="text-[11px] text-slate-500">
              {listing.isSet ? `ยกชุด ${listing.totalVolumes || 2} เล่ม` : 'เล่มเดียว'}
            </p>
            <GradeBadge grade={listing.grade} size="sm" />
          </div>
        </div>

        {locked && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            มีคนขอซื้อหนังสือเล่มนี้ · ล็อกการแก้ไขและซ่อนประกาศชั่วคราว
            จนกว่าจะปิดคำขอ
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ราคาขาย
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-300">฿</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              disabled={locked}
              onChange={(event) => {
                setPrice(event.target.value);
                setError(null);
              }}
              aria-label="ราคาขาย"
              className="flex-1 min-h-[52px] px-3 text-2xl font-black text-slate-900 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            ราคาใหม่จะมีผลกับคำสั่งซื้อใหม่ (ออเดอร์ที่มีอยู่แล้วจะยึดตามราคาตอนสั่งซื้อ)
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            วิธีรับหนังสือ
          </h2>

          <button
            type="button"
            disabled={locked}
            onClick={() => setMeetup((prev) => !prev)}
            className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left disabled:opacity-50 ${
              meetup
                ? 'border-[var(--color-primary)] bg-emerald-50/50'
                : 'border-slate-200'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                meetup
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                  : 'border-slate-300'
              }`}
            >
              {meetup && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
            <MapPin className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800 flex-1">นัดรับใน มช. · ฿0</span>
          </button>

          <button
            type="button"
            disabled={locked || (!canParcel && !parcel)}
            onClick={() => {
              if (!canParcel && !parcel) return;
              setParcel((prev) => !prev);
            }}
            className={`w-full flex items-center gap-2.5 p-3 rounded-xl border text-left disabled:opacity-50 ${
              parcel
                ? 'border-[var(--color-primary)] bg-emerald-50/50'
                : 'border-slate-200'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                parcel
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                  : 'border-slate-300'
              }`}
            >
              {parcel && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </span>
            <Truck className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-800 flex-1">
              ส่งพัสดุ
              {!canParcel && (
                <span className="block text-[10px] font-normal text-slate-400">
                  ต้องยืนยันตัวตน (KYC) และเปิดรับส่งพัสดุในตั้งค่าร้านก่อน
                </span>
              )}
            </span>
          </button>

          {parcel && (
            <p className="pl-8 text-[11px] text-slate-500">ค่าส่งระบบคำนวณให้ผู้ซื้ออัตโนมัติ</p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}

        {listing.status === 'HIDDEN' ? (
          <Button
            variant="outline"
            fullWidth
            disabled={locked}
            leftIcon={<Eye className="w-4 h-4" />}
            onClick={async () => {
              try {
                await setListingStatus(listing.id, 'ACTIVE');
                setToastMessage('แสดงประกาศอีกครั้งแล้ว');
                setTimeout(() => router.push('/seller'), 500);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ');
              }
            }}
          >
            แสดงประกาศอีกครั้ง
          </Button>
        ) : (
          <Button
            variant="outline"
            fullWidth
            disabled={locked}
            leftIcon={<EyeOff className="w-4 h-4" />}
            onClick={async () => {
              try {
                await setListingStatus(listing.id, 'HIDDEN');
                setToastMessage('ซ่อนประกาศแล้ว · ผู้ซื้อจะไม่เห็น');
                setTimeout(() => router.push('/seller'), 500);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'อัปเดตสถานะไม่สำเร็จ');
              }
            }}
          >
            ซ่อนประกาศชั่วคราว
          </Button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" isLoading={saving} onClick={handleSave} disabled={locked}>
            {locked ? 'ล็อกอยู่ · ปิดออเดอร์ก่อน' : 'บันทึกการแก้ไข'}
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
