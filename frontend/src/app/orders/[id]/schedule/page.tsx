'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { DateTimePicker, MapPinPicker, ScheduleValue, MapPoint } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { ViewRole } from '@/types/v4';
import { MapPin, Clock, Info, CheckCircle2 } from 'lucide-react';

export default function OrderSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, proposeSchedule, confirmSchedule } = useV4Orders();

  const order = getOrder(resolvedParams.id);
  const [role, setRole] = useState<ViewRole>('SELLER');

  const [when, setWhen] = useState<ScheduleValue | null>(
    order?.schedule
      ? { dateISO: order.schedule.dateISO, timeLabel: order.schedule.timeLabel }
      : null
  );
  const [point, setPoint] = useState<MapPoint | null>(
    order?.schedule ? { lat: order.schedule.lat, lng: order.schedule.lng } : null
  );
  const [landmark, setLandmark] = useState(order?.schedule?.landmark ?? '');
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'buyer' ? 'BUYER' : 'SELLER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="นัดรับ" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้</p>
      </div>
    );
  }

  const confirmed = order.schedule?.confirmedByBuyer ?? false;
  const canPropose = role === 'SELLER' && order.status === 'ACCEPTED';
  const canConfirm =
    role === 'BUYER' && order.status === 'ACCEPTED' && !!order.schedule && !confirmed;

  const handlePropose = () => {
    if (!when) {
      setError('เลือกวันและเวลา');
      return;
    }
    if (!point) {
      setError('ปักหมุดจุดนัดบนแผนที่');
      return;
    }
    if (landmark.trim().length < 3) {
      setError('ระบุจุดสังเกตอย่างน้อย 3 ตัวอักษร');
      return;
    }
    setError(null);
    proposeSchedule(order.id, {
      dateISO: when.dateISO,
      timeLabel: when.timeLabel,
      lat: point.lat,
      lng: point.lng,
      landmark: landmark.trim(),
      proposedBy: 'SELLER',
      confirmedByBuyer: false,
    });
    setToastMessage('ส่งนัดให้ผู้ซื้อแล้ว · รอผู้ซื้อยืนยัน');
    setTimeout(() => router.push(`/orders/${order.id}?role=seller`), 800);
  };

  const handleConfirm = () => {
    confirmSchedule(order.id);
    setToastMessage('ยืนยันนัดแล้ว · ออเดอร์อยู่ในสถานะนัดรับ');
    setTimeout(() => router.push(`/orders/${order.id}`), 800);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="นัดรับหนังสือ"
        onBack={() => router.push(`/orders/${order.id}`)}
      />

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 flex items-start gap-2.5 text-[11px] text-teal-900 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            ผู้ขายเสนอวันเวลาและปักหมุดจุดนัด · ผู้ซื้อยืนยันอีกครั้ง
            แล้วจึงเจอกันเพื่อตรวจหนังสือและจ่ายเงิน
          </span>
        </div>

        {order.schedule && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <MapPin className="w-4 h-4 text-teal-600" />
              {order.schedule.landmark}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              {order.schedule.dateISO} · {order.schedule.timeLabel}
            </div>
            <div className="text-[11px]">
              {confirmed ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ผู้ซื้อยืนยันนัดแล้ว
                </span>
              ) : (
                <span className="text-amber-700 font-semibold">
                  รอผู้ซื้อยืนยันนัด
                </span>
              )}
            </div>
          </div>
        )}

        {role === 'SELLER' ? (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                วันและเวลา
              </h2>
              <DateTimePicker
                value={when}
                onChange={(value) => {
                  setWhen(value);
                  setError(null);
                }}
                error={error?.includes('เวลา') ? error : undefined}
              />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                จุดนัดใน มช.
              </h2>
              <MapPinPicker
                value={point}
                onChange={(next) => {
                  setPoint(next);
                  setError(null);
                }}
                landmark={landmark}
                onLandmarkChange={(next) => {
                  setLandmark(next);
                  setError(null);
                }}
                error={error?.includes('หมุด') || error?.includes('จุด') ? error : undefined}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            {canPropose && (
              <Button fullWidth size="lg" onClick={handlePropose}>
                ส่งนัดให้ผู้ซื้อ
              </Button>
            )}
          </>
        ) : canConfirm ? (
          <Button fullWidth size="lg" onClick={handleConfirm}>
            ยืนยันนัดนี้
          </Button>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-[11px] text-slate-500 leading-relaxed">
            {confirmed
              ? 'นัดนี้ยืนยันแล้ว · ตรวจหนังสือและจ่ายเงินหน้างาน'
              : 'รอผู้ขายเสนอนัด · ใช้แชทออเดอร์คุยรายละเอียดได้'}
          </div>
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
