'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, EmptyState } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { useV4Orders } from '@/hooks/useV4Orders';
import { api } from '@/lib/api';
import { toV4Grade } from '@/lib/catalog';
import { BackendPublicShopResponse, mapPublicShopToShopProfile } from '@/lib/mappers';
import { DeliveryMethod, ShopProfile } from '@/types';
import {
  MeetupPoint,
  calcParcelFee,
  mapDirectionsUrl,
  mapEmbedUrl,
  shipDeadlineDays,
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

// Fallback campus point if a seller has not yet added custom meetup points.
const FALLBACK_POINTS: MeetupPoint[] = [
  { id: 'fb-1', name: 'หน้าหอสมุดกลาง มช.', province: 'เชียงใหม่', lat: 18.8023, lng: 98.9524 },
];

export default function CartPage() {
  const router = useRouter();
  const {
    items,
    sellerId,
    sellerName,
    addresses,
    addressesLoading,
    selectedAddress,
    setSelectedAddress,
    removeFromCart,
    clearCart,
    bookTotal,
  } = useCart();
  const { createOrder } = useV4Orders();

  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!sellerId) {
      setShop(null);
      return;
    }
    api
      .get<BackendPublicShopResponse>(`/api/shops/${sellerId}`)
      .then((res) => {
        if (active) setShop(mapPublicShopToShopProfile(res));
      })
      .catch(() => {
        if (active) setShop(null);
      });
    return () => {
      active = false;
    };
  }, [sellerId]);

  const points = shop?.meetupPoints?.length ? shop.meetupPoints : FALLBACK_POINTS;
  const availableDays = useMemo(
    () => (shop?.availableDays?.length ? shop.availableDays : ['จ', 'อ', 'พ', 'พฤ', 'ศ']),
    [shop?.availableDays]
  );
  const slots = useMemo(
    () => (shop?.availableSlots?.length ? shop.availableSlots : ['เย็น 16–20 น.']),
    [shop?.availableSlots]
  );
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

  useEffect(() => {
    if (points.length && !points.some((p) => p.id === pointId)) {
      setPointId(points[0].id);
    }
  }, [points, pointId]);

  useEffect(() => {
    if (dates.length && !dates.some((d) => d.iso === dateISO)) {
      setDateISO(dates[0].iso);
    }
  }, [dates, dateISO]);

  useEffect(() => {
    if (slots.length && !slots.includes(slot)) {
      setSlot(slots[0]);
    }
  }, [slots, slot]);

  const point = points.find((p) => p.id === pointId) ?? points[0];
  const parcelFee = calcParcelFee(items.length, shop?.province, selectedAddress?.province);
  const shippingFee = delivery === 'PARCEL' ? parcelFee : 0;
  const total = bookTotal + shippingFee;
  const missingParcelAddress = delivery === 'PARCEL' && !selectedAddress;

  const handleSubmit = async () => {
    if (!items.length) return;
    if (delivery === 'PARCEL' && !selectedAddress) {
      setSubmitError('กรุณาเพิ่มหรือเลือกที่อยู่จัดส่งก่อนส่งคำขอซื้อ');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const id = await createOrder({
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
          grade: toV4Grade(book.grade),
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
          delivery === 'PARCEL' && selectedAddress
            ? {
                province: selectedAddress.province,
                receiverName: selectedAddress.fullName,
                receiverAddress: `${selectedAddress.detail} ${selectedAddress.subdistrict} ${selectedAddress.district} ${selectedAddress.province} ${selectedAddress.postalCode}`,
              }
            : undefined,
        shipWithinDays: shop ? shipDeadlineDays(shop.shipMode, shop.shipWithinDays) : 2,
      });
      clearCart();
      router.push(`/cart/success?id=${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'ส่งคำขอซื้อไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
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
              {selectedAddress ? (
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
              ) : (
                <Link
                  href="/addresses/edit?next=/cart"
                  className="block w-full p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100/70 text-left text-xs space-y-1"
                >
                  <span className="block font-bold text-amber-900">
                    {addressesLoading ? 'กำลังโหลดที่อยู่จัดส่ง...' : 'ยังไม่มีที่อยู่จัดส่ง'}
                  </span>
                  <span className="block text-amber-700">
                    แตะเพื่อเพิ่มที่อยู่สำหรับส่งพัสดุ →
                  </span>
                </Link>
              )}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  ผู้ขายยืนยันการส่ง · เก็บเงินปลายทาง
                  {shop ? ` · ส่งจาก${shop.province}` : ''} · ค่าส่ง ฿{parcelFee} แยกจากค่าหนังสือ
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
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />รับแล้ว → แชทในออเดอร์เปิด และนัดวันรับ</li>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />เจอกัน ตรวจหนังสือ แล้วจ่ายเงินสดหน้างาน</li>
              </>
            ) : (
              <>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />ผู้ขายยืนยันการส่ง (ค่าส่งตกลงกันเอง)</li>
                <li className="flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />รับของ จ่ายเงินปลายทาง → ถ่ายรูปยืนยัน</li>
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
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => {
                setSelectedAddress(addr);
                setIsAddressSheetOpen(false);
              }}
              className={clsx(
                'w-full text-left p-3.5 rounded-xl border',
                selectedAddress?.id === addr.id ? 'border-[var(--color-primary)] bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>{addr.fullName}</span>
                <span className="text-[10px] font-medium text-slate-400">{addr.province}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{addr.detail}</p>
            </button>
          ))}
          <Link href="/addresses/edit?next=/cart" className="block text-center text-xs font-bold text-[var(--color-primary)] py-2">
            + เพิ่มที่อยู่ใหม่
          </Link>
        </div>
      </BottomSheet>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg space-y-2">
          {submitError ? (
            <p className="text-[11px] font-semibold text-rose-600 text-center">{submitError}</p>
          ) : (
            <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400 text-center">
              <Info className="w-3 h-3" />
              ยังไม่ต้องจ่ายเงินตอนนี้ · รอผู้ขายตอบรับก่อน
            </p>
          )}
          <Button
            fullWidth
            size="lg"
            isLoading={isSubmitting}
            disabled={missingParcelAddress}
            onClick={handleSubmit}
          >
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
