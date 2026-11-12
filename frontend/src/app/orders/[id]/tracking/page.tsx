'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { TrackingForm, TrackingValue } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { ViewRole } from '@/types/v4';
import { Truck, Info, PackageCheck } from 'lucide-react';

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, markShipped } = useV4Orders();

  const order = getOrder(resolvedParams.id);
  const [role, setRole] = useState<ViewRole>('SELLER');
  const [value, setValue] = useState<TrackingValue>({
    carrier: order?.shipping?.carrier ?? 'Flash Express',
    trackingNumber: order?.shipping?.trackingNumber ?? '',
    boxPhoto: order?.shipping?.boxPhoto ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'buyer' ? 'BUYER' : 'SELLER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="การจัดส่ง" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้</p>
      </div>
    );
  }

  const isParcel = order.delivery === 'PARCEL';
  const shipped = order.status === 'SHIPPED' || order.status === 'COMPLETED';

  const handleSubmit = () => {
    if (!isParcel) {
      setError('ออเดอร์นี้เป็นการนัดรับ ไม่ต้องกรอกพัสดุ');
      return;
    }
    if (order.status !== 'PAID') {
      setError('ต้องรอสลิปผ่านก่อนจึงแจ้งจัดส่งได้');
      return;
    }
    if (value.trackingNumber.trim().length < 8) {
      setError('กรอกเลขพัสดุอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (!value.boxPhoto) {
      setError('แนบรูปกล่องพัสดุก่อนแจ้งจัดส่ง');
      return;
    }
    setError(null);
    markShipped(order.id, {
      carrier: value.carrier,
      trackingNumber: value.trackingNumber.trim(),
      boxPhoto: value.boxPhoto,
      receiverName: order.shipping?.receiverName,
    });
    setToastMessage('แจ้งจัดส่งแล้ว · รอผู้ซื้อกดรับของ');
    setTimeout(() => router.push(`/orders/${order.id}?role=seller`), 800);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="การจัดส่ง"
        onBack={() => router.push(`/orders/${order.id}${role === 'SELLER' ? '?role=seller' : ''}`)}
      />

      <div className="p-4 space-y-4">
        {!isParcel ? (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-[11px] text-teal-900 leading-relaxed">
            ออเดอร์นี้เป็นนัดรับ · ใช้หน้าจอนัดรับและรหัสรับของแทนการจัดส่ง
          </div>
        ) : role === 'SELLER' ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              ส่งภายใน 48 ชม. หลังสลิปผ่าน · กรอกขนส่ง เลขพัสดุ และแนบรูปกล่อง
              (ไม่ต้องใช้เบอร์โทรผู้รับในแชท)
            </div>

            {shipped ? (
              <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <PackageCheck className="w-4 h-4" />
                  แจ้งจัดส่งแล้ว
                </div>
                <p className="font-mono text-slate-700">
                  {order.shipping?.carrier} · {order.shipping?.trackingNumber}
                </p>
                <p className="text-[11px] text-slate-500">
                  รอผู้ซื้อกดรับของ · ระบบปิดออเดอร์อัตโนมัติใน 7 วัน
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <TrackingForm
                  value={value}
                  onChange={(patch) => {
                    setValue((prev) => ({ ...prev, ...patch }));
                    setError(null);
                  }}
                  onSubmit={handleSubmit}
                  error={error || undefined}
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}

            {!shipped && (
              <Button fullWidth size="lg" onClick={handleSubmit}>
                แจ้งจัดส่ง
              </Button>
            )}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Truck className="w-4 h-4 text-slate-500" />
              {shipped ? 'ผู้ขายจัดส่งแล้ว' : 'รอผู้ขายจัดส่ง'}
            </div>
            {order.shipping?.trackingNumber ? (
              <>
                <p className="text-[11px] text-slate-500">
                  {order.shipping.carrier}
                </p>
                <p className="font-mono font-bold text-emerald-700">
                  {order.shipping.trackingNumber}
                </p>
                {order.shipping.boxPhoto && (
                  <img
                    src={order.shipping.boxPhoto}
                    alt="รูปกล่องพัสดุ"
                    className="w-full rounded-xl border border-slate-200"
                  />
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ผู้ขายต้องส่งภายใน 48 ชม. หลังตรวจสลิปผ่าน ·
                ระบบจะแจ้งเตือนเมื่อมีเลขพัสดุ
              </p>
            )}
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
