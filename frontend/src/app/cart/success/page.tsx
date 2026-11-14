'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { Hourglass, MapPin, Truck } from 'lucide-react';
import { useV4Orders } from '@/hooks/useV4Orders';
import { formatThaiDate } from '@/lib/delivery';

export default function CartSuccessPage() {
  const router = useRouter();
  const { getOrder, fetchOrder } = useV4Orders();
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    setOrderId(id);
    if (id) {
      fetchOrder(id);
    }
  }, [fetchOrder]);

  const order = orderId ? getOrder(orderId) : undefined;

  return (
    <div className="flex flex-col min-h-screen bg-white select-none justify-between p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 pt-10">
        <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center animate-pop">
          <Hourglass className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          {order && <span className="text-xs font-mono font-semibold text-slate-400">ออเดอร์ #{order.id}</span>}
          <h1 className="text-2xl font-black text-slate-900">ส่งคำขอซื้อแล้ว</h1>
        </div>

        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          รอ <span className="font-bold text-slate-800">{order?.shop.shopName ?? 'ผู้ขาย'}</span> ตอบรับคำขอ
          · ระบบจะแจ้งเตือนทาง LINE เมื่อผู้ขายรับแล้ว
        </p>

        {order && (
          <div className="w-full max-w-xs p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-2 mt-2">
            <div className="flex items-start gap-2 text-slate-600">
              {order.delivery === 'MEETUP' ? (
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              ) : (
                <Truck className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span>
                {order.delivery === 'MEETUP' && order.schedule
                  ? `นัดรับ ${order.schedule.landmark} · ${formatThaiDate(order.schedule.dateISO)} ${order.schedule.timeLabel}`
                  : `ส่งพัสดุถึง ${order.shipping?.receiverName ?? ''}`}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-200">
              <span>ยอดรวม</span>
              <span className="font-bold text-[var(--color-primary)]">฿{order.total.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2.5 pt-6 pb-2 safe-area-bottom">
        <Button fullWidth size="lg" onClick={() => router.push(order ? `/orders/${order.id}` : '/orders')}>
          ดูสถานะออเดอร์
        </Button>
        <Button fullWidth size="lg" variant="outline" onClick={() => router.push('/')}>
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}
