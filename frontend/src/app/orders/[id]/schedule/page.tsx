'use client';

import React, { useEffect, useMemo, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { AdminOrderDryRunBar } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { DRY_RUN_FALLBACK_SHOP } from '@/lib/adminOrderDryRun';
import { api } from '@/lib/api';
import {
  expandShopHourlySlots,
  isSlotBookedForDate,
  upcomingDates,
} from '@/lib/delivery';
import {
  BackendPublicShopResponse,
  mapPublicShopToShopProfile,
} from '@/lib/mappers';
import { ShopProfile } from '@/types';
import { MapPin, Clock, CalendarDays, Lock, CheckCircle2 } from 'lucide-react';

export default function OrderSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, fetchOrder, loading, proposeSchedule, isMineAsBuyer, isDryRunOrder } =
    useV4Orders();

  const order = getOrder(resolvedParams.id);
  const isBuyer = order ? isMineAsBuyer(order) : true;
  const isDryRun = isDryRunOrder(resolvedParams.id);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [loadingShop, setLoadingShop] = useState(false);

  const [pointId, setPointId] = useState('');
  const [dateISO, setDateISO] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!order) fetchOrder(resolvedParams.id);
  }, [resolvedParams.id, order, fetchOrder]);

  useEffect(() => {
    if (!order?.shopId || order.status !== 'ACCEPTED') return;
    if (isDryRun && order.shopId === DRY_RUN_FALLBACK_SHOP.id) {
      setShop(DRY_RUN_FALLBACK_SHOP);
      return;
    }
    let active = true;
    setLoadingShop(true);
    api
      .get<BackendPublicShopResponse>(`/api/shops/${order.shopId}`)
      .then((res) => {
        if (!active) return;
        const mapped = mapPublicShopToShopProfile(res);
        setShop(
          isDryRun && mapped.meetupPoints.length === 0
            ? { ...mapped, meetupPoints: DRY_RUN_FALLBACK_SHOP.meetupPoints }
            : mapped
        );
      })
      .catch(() => {
        if (active) setShop(isDryRun ? DRY_RUN_FALLBACK_SHOP : null);
      })
      .finally(() => {
        if (active) setLoadingShop(false);
      });
    return () => {
      active = false;
    };
  }, [order?.shopId, order?.status, isDryRun]);

  const points = shop?.meetupPoints ?? [];
  const dates = useMemo(() => {
    const availableDays = shop?.availableDays?.length
      ? shop.availableDays
      : ['จ', 'อ', 'พ', 'พฤ', 'ศ'];
    return upcomingDates(availableDays, 6, new Date());
  }, [shop]);

  const slots = useMemo(
    () => expandShopHourlySlots(shop?.availableSlots ?? []),
    [shop?.availableSlots]
  );
  const bookedSlots = shop?.bookedPickupSlots ?? [];

  useEffect(() => {
    if (!shop) return;
    if (!pointId && points.length > 0) {
      setPointId(points[0].id);
    }
    if (!dateISO || !timeLabel) {
      for (const d of dates) {
        for (const s of slots) {
          if (!isSlotBookedForDate(d.iso, s, bookedSlots)) {
            setDateISO((prev) => prev || d.iso);
            setTimeLabel((prev) => prev || s);
            return;
          }
        }
      }
    }
  }, [shop, points, dates, slots, bookedSlots, pointId, dateISO, timeLabel]);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="นัดรับ" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">
          {loading ? 'กำลังโหลดข้อมูลออเดอร์...' : 'ไม่พบออเดอร์นี้'}
        </p>
      </div>
    );
  }

  const isLocked = order.status !== 'ACCEPTED';
  const selectedPoint = points.find((p) => p.id === pointId) ?? points[0];
  const isChosenSlotBooked =
    Boolean(dateISO && timeLabel) && isSlotBookedForDate(dateISO, timeLabel, bookedSlots);

  const handleSave = async () => {
    if (!selectedPoint) {
      setError('กรุณาเลือกจุดนัดรับของร้าน');
      return;
    }
    if (!dateISO || !timeLabel) {
      setError('กรุณาเลือกวันและเวลานัดรับที่ว่างอยู่');
      return;
    }
    if (isChosenSlotBooked) {
      setError('ช่วงเวลานี้มีคำสั่งซื้ออื่นจองไว้แล้ว กรุณาเลือกเวลาอื่น');
      return;
    }

    setError(null);
    setSubmitting(true);
    const res = await proposeSchedule(order.id, {
      dateISO,
      timeLabel,
      lat: selectedPoint.lat,
      lng: selectedPoint.lng,
      landmark: selectedPoint.name,
      proposedBy: isBuyer ? 'BUYER' : 'SELLER',
      confirmedByBuyer: isBuyer,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'บันทึกนัดหมายไม่สำเร็จ');
      return;
    }

    setToastMessage(
      isBuyer ? 'ล็อกนัดรับเรียบร้อยแล้ว' : 'ส่งข้อเสนอเวลานัดรับให้ผู้ซื้อยืนยันแล้ว'
    );
    setTimeout(() => router.push(`/orders/${order.id}`), 700);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <TopBar
        title="นัดรับหนังสือ"
        onBack={() => router.push(`/orders/${order.id}`)}
      />

      <div className="p-4 space-y-4">
        <AdminOrderDryRunBar orderId={order.id} delivery={order.delivery} status={order.status} />
        {isLocked ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 leading-relaxed">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-teal-700" />
              <span>
                นัดหมายถูกล็อกแล้ว ไม่สามารถเปลี่ยนวันเวลาหรือสถานที่ได้
                (หากไม่สะดวก กรุณาคุยในแชทออเดอร์หรือยกเลิกคำสั่งซื้อ)
              </span>
            </div>

            {order.schedule && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  {order.schedule.landmark}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Clock className="w-3.5 h-3.5" />
                  {order.schedule.dateISO} · {order.schedule.timeLabel}
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ยืนยันนัดเรียบร้อย
                </div>
              </div>
            )}

            <Button fullWidth onClick={() => router.push(`/orders/${order.id}`)}>
              กลับหน้าคำสั่งซื้อ
            </Button>
          </div>
        ) : loadingShop ? (
          <div className="h-44 rounded-2xl bg-slate-200 animate-pulse" />
        ) : (
          <>
            <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 text-[11px] text-teal-900 leading-relaxed">
              เลือกจากจุดนัดรับและตารางเวลาที่ร้านว่างอยู่เท่านั้น · เมื่อบันทึกแล้วระบบจะล็อกนัดและออกรหัส 6 หลักทันที
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <MapPin className="w-4 h-4 text-teal-600" />
                จุดนัดรับของร้าน
              </span>
              {points.length === 0 ? (
                <p className="text-xs text-rose-600">ร้านนี้ยังไม่มีจุดนัดรับ</p>
              ) : (
                <div className="space-y-1.5">
                  {points.map((p) => {
                    const selected = p.id === selectedPoint?.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPointId(p.id)}
                        className={clsx(
                          'w-full text-left p-3 rounded-xl border text-xs transition',
                          selected
                            ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <div>{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.province}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  วันที่ผู้ขายสะดวก
                </span>
                {dates.length === 0 ? (
                  <p className="text-xs text-rose-600">ไม่มีวันที่ว่างในขณะนี้</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {dates.map((d) => {
                      const full = slots.every((s) =>
                        isSlotBookedForDate(d.iso, s, bookedSlots)
                      );
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          disabled={full}
                          onClick={() => {
                            setDateISO(d.iso);
                            if (isSlotBookedForDate(d.iso, timeLabel, bookedSlots)) {
                              const free = slots.find(
                                (s) => !isSlotBookedForDate(d.iso, s, bookedSlots)
                              );
                              if (free) setTimeLabel(free);
                            }
                            setError(null);
                          }}
                          className={clsx(
                            'shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold transition',
                            full
                              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through cursor-not-allowed'
                              : d.iso === dateISO
                                ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                                : 'bg-white border-slate-200 text-slate-700'
                          )}
                        >
                          {d.label}
                          {full ? ' (เต็ม)' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  ช่วงเวลานัดรับ (1 ชม./คิว)
                </span>
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => {
                    const booked = isSlotBookedForDate(dateISO, s, bookedSlots);
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={booked}
                        onClick={() => {
                          setTimeLabel(s);
                          setError(null);
                        }}
                        className={clsx(
                          'px-3 py-2 rounded-xl border text-xs font-semibold transition',
                          booked
                            ? 'bg-slate-100 border-slate-200 text-slate-400 line-through cursor-not-allowed'
                            : s === timeLabel
                              ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                              : 'bg-white border-slate-200 text-slate-700'
                        )}
                      >
                        {s}
                        {booked ? ' (มีนัดแล้ว)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              onClick={handleSave}
              disabled={submitting || !selectedPoint || !dateISO || !timeLabel || isChosenSlotBooked}
            >
              {submitting ? 'กำลังล็อกนัดรับ...' : 'ยืนยันและล็อกเวลานัดรับ'}
            </Button>
          </>
        )}
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
