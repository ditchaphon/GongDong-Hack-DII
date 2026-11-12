'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  BottomSheet,
  EmptyState,
  Toast,
} from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { MOCK_ADDRESSES } from '@/mocks/books';
import {
  Trash2,
  MapPin,
  Truck,
  Calendar,
  Clock,
  ChevronRight,
  ShieldAlert,
  ShoppingBag,
} from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    sellerName,
    deliveryMethod,
    setDeliveryMethod,
    meetupZone,
    setMeetupZone,
    meetupTime,
    setMeetupTime,
    meetupNote,
    setMeetupNote,
    selectedAddress,
    setSelectedAddress,
    removeFromCart,
    clearCart,
    bookTotal,
    shippingFee,
    grandTotal,
  } = useCart();

  const [isZoneSheetOpen, setIsZoneSheetOpen] = useState(false);
  const [isTimeSheetOpen, setIsTimeSheetOpen] = useState(false);
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const zones = [
    'หน้าหอสมุดกลาง มช.',
    'ประตูหน้า มช.',
    'หอพักนักศึกษา ชาย/หญิง',
    'คณะวิศวกรรมศาสตร์',
    'คณะมนุษยศาสตร์',
  ];

  const timeSlots = [
    'วันศุกร์ 13 พ.ย. 12:00 - 13:00 น.',
    'วันศุกร์ 13 พ.ย. 16:30 - 17:30 น.',
    'วันเสาร์ 14 พ.ย. 10:00 - 11:30 น.',
    'วันเสาร์ 14 พ.ย. 14:00 - 15:30 น.',
  ];

  const handleSubmitOrder = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      router.push('/cart/success');
    }, 800);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="ตะกร้าสินค้า" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 w-full text-center">
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-slate-400" />}
              title="ไม่มีหนังสือในตะกร้า"
              description="เลือกดูหนังสือสภาพดีที่คุณสนใจ แล้วเพิ่มลงในตะกร้าเพื่อเริ่มสั่งซื้อ"
              actionText="ไปค้นหาหนังสือ"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <TopBar title={`ตะกร้า · ร้าน${sellerName}`} />

      <div className="p-4 space-y-4">
        {/* Book items in cart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-700">
              หนังสือจากร้าน {sellerName} ({items.length} เล่ม)
            </span>
            <button
              type="button"
              onClick={clearCart}
              className="text-slate-400 hover:text-rose-500 transition"
            >
              ลบทั้งหมด
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((book) => (
              <div key={book.id} className="py-3 flex gap-3 items-center">
                <img
                  src={book.photos.cover}
                  alt={book.title}
                  className="w-14 h-18 rounded-lg object-cover bg-slate-100 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">
                    {book.title}
                  </h4>
                  <div className="text-xs text-slate-400 mt-0.5">เกรด {book.grade}</div>
                  <div className="text-sm font-bold text-[#06C755] mt-1">
                    ฿{book.price.toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(book.id)}
                  aria-label="ลบเล่มนี้"
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Method Selection (B3 / B3D) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            เลือกวิธีรับหนังสือ
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeliveryMethod('MEETUP')}
              className={`p-3 rounded-2xl border flex flex-col items-start gap-1 text-left transition ${
                deliveryMethod === 'MEETUP'
                  ? 'border-[#06C755] bg-emerald-50/50 text-[#059669] ring-2 ring-[#06C755]/20 font-bold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>นัดรับใน มช.</span>
              </div>
              <span className="text-sm font-black text-emerald-600">฿0 ฟรี</span>
            </button>

            <button
              type="button"
              onClick={() => setDeliveryMethod('PARCEL')}
              className={`p-3 rounded-2xl border flex flex-col items-start gap-1 text-left transition ${
                deliveryMethod === 'PARCEL'
                  ? 'border-[#06C755] bg-emerald-50/50 text-[#059669] ring-2 ring-[#06C755]/20 font-bold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs">
                <Truck className="w-4 h-4 text-slate-500" />
                <span>ส่งพัสดุ</span>
              </div>
              <span className="text-sm font-black text-slate-800">
                ฿{shippingFee}
              </span>
            </button>
          </div>

          {/* If Meetup: Zone + Time Pickers */}
          {deliveryMethod === 'MEETUP' ? (
            <div className="pt-2 space-y-2 border-t border-slate-100">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsZoneSheetOpen(true)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-500">จุดนัดรับ: </span>
                    <span className="font-bold text-slate-800">{meetupZone}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsTimeSheetOpen(true)}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="text-slate-500">วัน-เวลานัด: </span>
                    <span className="font-bold text-slate-800">{meetupTime}</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <input
                type="text"
                value={meetupNote}
                onChange={(e) => setMeetupNote(e.target.value)}
                placeholder="ระบุจุดสังเกตเพิ่มเติม (เช่น เสื้อสีน้ำเงิน, หน้าทางเข้า)"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-[#06C755]"
              />
            </div>
          ) : (
            /* If Parcel: Shipping Address Selector */
            <div className="pt-2 space-y-2 border-t border-slate-100">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setIsAddressSheetOpen(true)}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    ที่อยู่จัดส่ง: {selectedAddress.fullName}
                  </span>
                  <span className="text-xs text-[#06C755] font-semibold">เปลี่ยน</span>
                </div>
                <p className="text-slate-500 leading-snug">
                  {selectedAddress.detail} {selectedAddress.subdistrict} {selectedAddress.district}{' '}
                  {selectedAddress.province} {selectedAddress.postalCode}
                </p>
                <p className="text-slate-400 font-mono">โทร: {selectedAddress.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>ค่าหนังสือ ({items.length} เล่ม)</span>
            <span className="font-semibold text-slate-800">฿{bookTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ค่าจัดส่ง ({deliveryMethod === 'MEETUP' ? 'นัดรับ มช.' : 'พัสดุ'})</span>
            <span className="font-semibold text-slate-800">
              {shippingFee === 0 ? '฿0 ฟรี' : `฿${shippingFee}`}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-900">ยอดรวมทั้งสิ้น</span>
            <span className="text-xl font-black text-[#06C755]">
              ฿{grandTotal.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Zone Picker BottomSheet (ZONE) */}
      <BottomSheet
        isOpen={isZoneSheetOpen}
        onClose={() => setIsZoneSheetOpen(false)}
        title="เลือกจุดนัดรับใน มช."
      >
        <div className="space-y-2 py-2">
          {zones.map((zone) => (
            <label
              key={zone}
              onClick={() => {
                setMeetupZone(zone);
                setIsZoneSheetOpen(false);
              }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <span className="text-sm font-medium text-slate-800">{zone}</span>
              <input
                type="radio"
                name="cart_zone"
                checked={meetupZone === zone}
                onChange={() => {}}
                className="accent-[#06C755] w-4 h-4"
              />
            </label>
          ))}
        </div>
      </BottomSheet>

      {/* Time Picker BottomSheet (TIME) */}
      <BottomSheet
        isOpen={isTimeSheetOpen}
        onClose={() => setIsTimeSheetOpen(false)}
        title="เลือกวัน-เวลานัดพบ"
      >
        <div className="space-y-2 py-2">
          {timeSlots.map((slot) => (
            <label
              key={slot}
              onClick={() => {
                setMeetupTime(slot);
                setIsTimeSheetOpen(false);
              }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <span className="text-sm font-medium text-slate-800">{slot}</span>
              <input
                type="radio"
                name="cart_time"
                checked={meetupTime === slot}
                onChange={() => {}}
                className="accent-[#06C755] w-4 h-4"
              />
            </label>
          ))}
        </div>
      </BottomSheet>

      {/* Address Switcher BottomSheet */}
      <BottomSheet
        isOpen={isAddressSheetOpen}
        onClose={() => setIsAddressSheetOpen(false)}
        title="เลือกที่อยู่จัดส่ง"
      >
        <div className="space-y-2 py-2">
          {MOCK_ADDRESSES.map((addr) => (
            <div
              key={addr.id}
              onClick={() => {
                setSelectedAddress(addr);
                setIsAddressSheetOpen(false);
              }}
              className={`p-3.5 rounded-xl border cursor-pointer ${
                selectedAddress.id === addr.id
                  ? 'border-[#06C755] bg-emerald-50/40'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>{addr.fullName}</span>
                {addr.isDefault && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    ค่าเริ่มต้น
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">{addr.detail}</p>
            </div>
          ))}
          <Link
            href="/addresses/edit"
            className="block text-center text-xs font-bold text-[#06C755] py-2"
          >
            + เพิ่มที่อยู่ใหม่
          </Link>
        </div>
      </BottomSheet>

      {/* Fixed Submit Order Button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            isLoading={isSubmitting}
            onClick={handleSubmitOrder}
          >
            ส่งคำขอซื้อ (฿{grandTotal.toLocaleString()})
          </Button>
        </div>
      </div>
    </div>
  );
}

