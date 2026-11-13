'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, EmptyState } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useV4Orders } from '@/hooks/useV4Orders';
import { MOCK_ADDRESSES } from '@/mocks/books';
import { getShopById } from '@/mocks/shops';
import { BookGrade, DeliveryMethod } from '@/types';
import { V4Grade } from '@/types/v4';
import {
  MeetupPoint,
  calcParcelFee,
  mapDirectionsUrl,
  mapEmbedUrl,
  shipDeadlineDays,
  shipModeLabel,
  upcomingDates,
} from '@/lib/delivery';
import {
  Trash2,
  MapPin,
  Truck,
  CalendarDays,
  Clock,
  ShoppingBag,
  ExternalLink,
  Check,
  Hourglass,
  Info,
} from 'lucide-react';

const GRADE_TO_V4: Record<BookGrade, V4Grade> = {
  A: 'LIKE_NEW',
  B: 'GENTLY_READ',
  C: 'WELL_LOVED',
  D: 'WORN_BUT_READABLE',
};

// Shops without a public profile (e.g. demo listings) fall back to campus points.
const FALLBACK_POINTS: MeetupPoint[] = [
  { id: 'fb-1', name: 'หน้าหอสมุดกลาง มช.', province: 'เชียงใหม่', lat: 18.8023, lng: 98.9524 },
];

export default function CartPage() {
  const router = useRouter();
  const { items, sellerId, sellerName, selectedAddress, setSelectedAddress, removeFromCart, clearCart, bookTotal } =
    useCart();
  const { createOrder } = useV4Orders();

  const shop = sellerId ? getShopById(sellerId) : undefined;
  const points = shop?.meetupPoints?.length ? shop.meetupPoints : FALLBACK_POINTS;
  const availableDays = shop?.availableDays ?? ['จ', 'อ', 'พ', 'พฤ', 'ศ'];
  const slots = shop?.availableSlots?.length ? shop.availableSlots : ['เย็น 16–20 น.'];
  const dates = useMemo(() => upcomingDates(availableDays), [availableDays]);

  const canMeetup = items.length > 0 && items.every((book) => book.deliveryMethods.includes('MEETUP'));
  const canParcel =
    items.length > 0 &&
    items.every((book) => book.deliveryMethods.includes('PARCEL')) &&
    (shop ? shop.supportsParcel && shop.payeeVerified : true);

  const [method, setMethod] = useState<DeliveryMethod>(canMeetup ? 'MEETUP' : 'PARCEL');
  const delivery: DeliveryMethod = method === 'MEETUP' ? (canMeetup ? 'MEETUP' : 'PARCEL') : canParcel ? 'PARCEL' : 'MEETUP';

  const [pointId, setPointId] = useState(points[0]?.id);
  const [dateISO, setDateISO] = useState(dates[0]?.iso ?? '');
  const [slot, setSlot] = useState(slots[0]);
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const point = points.find((p) => p.id === pointId) ?? points[0];
  const parcelFee = calcParcelFee(items.length, shop?.province, selectedAddress.province);
  const shippingFee = delivery === 'PARCEL' ? parcelFee : 0;
  const total = bookTotal + shippingFee;

  const handleSubmit = () => {
    if (!items.length) return;
    setIsSubmitting(true);
    const id = createOrder({
      delivery,
      shopId: sellerId ?? undefined,
      shop: {
        shopName: shop?.shopName ?? sellerName ?? 'ร้านหนังสือ',
        avatar: shop?.avatar ?? items[0].sellerAvatar,
        rating: shop?.rating ?? items[0].sellerRating,
        completedSales: shop?.completedSales ?? 0,
        payeeVerified: shop?.payeeVerified ?? items[0].isPromptPayVerified,
      },
      books: items.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        cover: book.photos.cover,
        grade: GRADE_TO_V4[book.grade],
        price: book.price,
      })),
      shippingFee,
      schedule:
        delivery === 'MEETUP' && point
          ? {
              dateISO,
              timeLabel: slot,
              lat: point.lat,
              lng: point.lng,
              landmark: point.name,
              proposedBy: 'BUYER',
              confirmedByBuyer: true,
            }
          : undefined,
      shipping:
        delivery === 'PARCEL'
          ? {
              receiverName: selectedAddress.fullName,
              receiverAddress: `${selectedAddress.detail} ${selectedAddress.subdistrict} ${selectedAddress.district} ${selectedAddress.province} ${selectedAddress.postalCode}`,
            }
          : undefined,
      shipWithinDays: shop ? shipDeadlineDays(shop.shipMode, shop.shipWithinDays) : 2,
    });
    clearCart();
    router.push(`/cart/success?id=${id}`);
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
              description="เลือกดูหนังสือที่คุณสนใจ แล้วเพิ่มลงในตะกร้าเพื่อส่งคำขอซื้อ"
              actionText="ไปค้นหาหนังสือ"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-36">
      <TopBar title="ส่งคำขอซื้อ" subtitle={shop?.shopName ?? sellerName ?? undefined} />

      <div className="p-4 space-y-4">
        {/* Books */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
            <span className="font-bold text-slate-700">หนังสือ {items.length} เล่ม</span>
            <button type="button" onClick={clearCart} className="text-slate-400 hover:text-rose-500">
              ลบทั้งหมด
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((book) => (
              <div key={book.id} className="py-3 flex gap-3 items-center">
                <img src={book.photos.cover} alt={book.title} className="w-12 h-16 rounded-lg object-cover bg-slate-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">{book.title}</h4>
                  <div className="text-xs text-slate-400 mt-0.5">เกรด {book.grade}</div>
                  <div className="text-sm font-bold text-[var(--color-primary)] mt-0.5">฿{book.price.toLocaleString()}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(book.id)}
                  aria-label="ลบเล่มนี้"
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Delivery method */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">เลือกวิธีรับหนังสือ</h3>
          <div className="grid grid-cols-2 gap-2">
            <MethodCard
              active={delivery === 'MEETUP'}
              disabled={!canMeetup}
              onClick={() => setMethod('MEETUP')}
              icon={<MapPin className="w-4 h-4" />}
              title="นัดรับ"
              price="ฟรี"
              note={canMeetup ? `${points.length} จุดที่ร้านตั้งไว้` : 'ร้านไม่เปิดนัดรับ'}
            />
            <MethodCard
              active={delivery === 'PARCEL'}
              disabled={!canParcel}
              onClick={() => setMethod('PARCEL')}
              icon={<Truck className="w-4 h-4" />}
              title="ส่งพัสดุ"
              price={canParcel ? `฿${parcelFee}` : '—'}
              note={canParcel ? 'ระบบคำนวณค่าส่ง' : 'ร้านไม่เปิดส่งพัสดุ'}
            />
          </div>

          {delivery === 'MEETUP' ? (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">จุดนัดรับของร้าน</span>
                  <span className="text-[10px] text-slate-400">ผู้ขายเป็นคนกำหนดจุด</span>
                </div>
                <div role="radiogroup" aria-label="จุดนัดรับ" className="space-y-2">
                  {points.map((p) => {
                    const selected = p.id === point?.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPointId(p.id)}
                        className={clsx(
                          'w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition',
                          selected ? 'border-[var(--color-primary)] bg-emerald-50 ring-2 ring-[var(--color-primary)]/15' : 'border-slate-200 hover:bg-slate-50'
                        )}
                      >
                        <span
                          className={clsx(
                            'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            selected ? 'border-[var(--color-primary)]' : 'border-slate-300'
                          )}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                        </span>
                        <span className="flex-1 text-xs">
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">{p.province}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {point && (
                <div className="rounded-2xl overflow-hidden border border-slate-200">
                  <iframe
                    key={point.id}
                    title={`แผนที่ ${point.name}`}
                    src={mapEmbedUrl(point.lat, point.lng)}
                    className="w-full h-48 border-0 block"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <a
                    href={mapDirectionsUrl(point.lat, point.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-xs font-semibold text-[var(--color-primary-dark)] hover:bg-slate-50 border-t border-slate-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    เปิดใน Google Maps
                  </a>
                </div>
              )}

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  วันที่สะดวก
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {dates.map((d) => (
                    <Pill key={d.iso} selected={d.iso === dateISO} onClick={() => setDateISO(d.iso)}>
                      {d.label}
                    </Pill>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  ช่วงเวลา
                </span>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Pill key={s} selected={s === slot} onClick={() => setSlot(s)}>
                      {s}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddressSheetOpen(true)}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left text-xs space-y-1"
              >
                <span className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">ส่งถึง: {selectedAddress.fullName}</span>
                  <span className="text-[var(--color-primary)] font-semibold">เปลี่ยน</span>
                </span>
                <span className="block text-slate-500 leading-snug">
                  {selectedAddress.detail} {selectedAddress.subdistrict} {selectedAddress.district}{' '}
                  {selectedAddress.province} {selectedAddress.postalCode}
                </span>
              </button>
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  {shop ? shipModeLabel(shop.shipMode, shop.shipWithinDays) : 'ผู้ขายส่งภายใน 2 วันหลังชำระเงิน'}
                  {shop ? ` · ส่งจาก${shop.province}` : ''} · ค่าส่ง ฿{parcelFee} คำนวณโดยระบบ
                </span>
              </div>
            </div>
          )}
        </section>

        {/* What happens next */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-700">หลังส่งคำขอ</h3>
          <ol className="space-y-1.5 text-[11px] text-slate-600">
            <li className="flex gap-2"><Hourglass className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />ผู้ขายต้องตอบรับคำขอก่อน (ภายใน 24 ชม.)</li>
            {delivery === 'MEETUP' ? (
              <>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />รับแล้ว → แชทในออเดอร์เปิด และคุณได้ QR รับของ</li>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />เจอกัน ตรวจหนังสือ จ่ายเงิน แล้วให้ผู้ขายสแกน QR</li>
              </>
            ) : (
              <>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />รับแล้ว → ชำระเงิน (ระบบพักเงินไว้ให้)</li>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />ผู้ขายส่งของพร้อมเลขพัสดุ → ถ่ายรูปยืนยันเมื่อได้รับ</li>
              </>
            )}
          </ol>
        </section>

        {/* Price */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>ค่าหนังสือ ({items.length} เล่ม)</span>
            <span className="font-semibold text-slate-800">฿{bookTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ค่าจัดส่ง ({delivery === 'MEETUP' ? 'นัดรับ' : 'พัสดุ · ระบบคำนวณ'})</span>
            <span className="font-semibold text-slate-800">{shippingFee === 0 ? 'ฟรี' : `฿${shippingFee}`}</span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-900">ยอดรวม</span>
            <span className="text-xl font-black text-[var(--color-primary)]">฿{total.toLocaleString()}</span>
          </div>
        </section>
      </div>

      <BottomSheet isOpen={isAddressSheetOpen} onClose={() => setIsAddressSheetOpen(false)} title="เลือกที่อยู่จัดส่ง">
        <div className="space-y-2 py-2">
          {MOCK_ADDRESSES.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => {
                setSelectedAddress(addr);
                setIsAddressSheetOpen(false);
              }}
              className={clsx(
                'w-full text-left p-3.5 rounded-xl border',
                selectedAddress.id === addr.id ? 'border-[var(--color-primary)] bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>{addr.fullName}</span>
                <span className="text-[10px] font-medium text-slate-400">{addr.province}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{addr.detail}</p>
            </button>
          ))}
          <Link href="/addresses/edit" className="block text-center text-xs font-bold text-[var(--color-primary)] py-2">
            + เพิ่มที่อยู่ใหม่
          </Link>
        </div>
      </BottomSheet>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg space-y-2">
          <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400 text-center">
            <Info className="w-3 h-3" />
            ยังไม่ต้องจ่ายเงินตอนนี้ · รอผู้ขายตอบรับก่อน
          </p>
          <Button fullWidth size="lg" isLoading={isSubmitting} onClick={handleSubmit}>
            ส่งคำขอซื้อ · ฿{total.toLocaleString()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  price,
  note,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  price: string;
  note: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'p-3 rounded-2xl border flex flex-col items-start gap-1 text-left transition',
        active ? 'border-[var(--color-primary)] bg-emerald-50 ring-2 ring-[var(--color-primary)]/15' : 'border-slate-200 hover:bg-slate-50',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      <span className={clsx('flex items-center gap-1.5 text-xs font-bold', active ? 'text-emerald-800' : 'text-slate-700')}>
        {icon}
        {title}
      </span>
      <span className="text-sm font-black text-slate-900">{price}</span>
      <span className="text-[10px] text-slate-500">{note}</span>
    </button>
  );
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition',
        selected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  );
}
