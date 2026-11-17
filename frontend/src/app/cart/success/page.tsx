'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { AdminDemoBanner, LineOaBanner } from '@/components/v4';
import { Hourglass, MapPin, Truck, ChevronRight, Store } from 'lucide-react';
import { useLiff } from '@/hooks/useLiff';
import { useV4Orders } from '@/hooks/useV4Orders';
import { formatThaiDate } from '@/lib/delivery';

export default function CartSuccessPage() {
  const router = useRouter();
  const { user } = useLiff();
  const { getOrder, fetchOrder, isDryRunOrder } = useV4Orders();
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [isDemoParam, setIsDemoParam] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsDemoParam(params.get('demo') === '1');
    const idsParam = params.get('ids');
    const idParam = params.get('id');
    const parsedIds = idsParam
      ? idsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : idParam
        ? [idParam.trim()]
        : [];
    setOrderIds(parsedIds);
    parsedIds.forEach((id) => {
      fetchOrder(id);
    });
  }, [fetchOrder]);

  const createdOrders = orderIds
    .map((id) => getOrder(id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  const isMulti = orderIds.length > 1;
  const grandTotal = createdOrders.reduce((sum, o) => sum + o.total, 0);
  const isDryRun =
    Boolean(user.isAdmin) &&
    (isDemoParam || orderIds.some((id) => isDryRunOrder(id)));

  return (
    <div className="flex flex-col min-h-screen bg-white select-none justify-between p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 pt-6">
        {isDryRun && (
          <AdminDemoBanner
            title="Admin Order Dry-Run · จำลองคำขอซื้อสำเร็จ"
            description="สร้างคำขอซื้อจำลองเรียบร้อย กดดูออเดอร์ด้านล่างเพื่อสลับมุมมอง ผู้ซื้อ ↔ ผู้ขาย ทดสอบต่อได้เลย"
          />
        )}
        <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center animate-pop">
          <Hourglass className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          {!isMulti && orderIds[0] && (
            <span className="text-xs font-mono font-semibold text-slate-400">
              ออเดอร์ #{orderIds[0]}
            </span>
          )}
          <h1 className="text-2xl font-black text-slate-900">
            {isMulti ? `ส่งคำขอซื้อสำเร็จ ${orderIds.length} ร้าน` : 'ส่งคำขอซื้อแล้ว'}
          </h1>
        </div>

        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          {isMulti
            ? 'ระบบแยกออเดอร์ตามร้านค้าให้เรียบร้อยแล้ว · แจ้งเตือนทาง LINE เมื่อแต่ละร้านตอบรับ'
            : `รอ ${createdOrders[0]?.shop.shopName ?? 'ผู้ขาย'} ตอบรับคำขอ · ระบบจะแจ้งเตือนทาง LINE เมื่อผู้ขายรับแล้ว`}
        </p>

        <LineOaBanner className="w-full max-w-sm text-left" />

        {createdOrders.length > 0 && (
          <div className="w-full max-w-sm space-y-2.5 mt-2 text-left">
            {createdOrders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                    <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{order.shop.shopName}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[var(--color-primary)] inline-flex items-center shrink-0">
                    ดูออเดอร์ <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="flex items-start gap-2 text-slate-600">
                  {order.delivery === 'MEETUP' ? (
                    <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                  ) : (
                    <Truck className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span className="line-clamp-2">
                    {order.delivery === 'MEETUP' && order.schedule
                      ? `นัดรับ ${order.schedule.landmark} · ${formatThaiDate(order.schedule.dateISO)} ${order.schedule.timeLabel}`
                      : `ส่งพัสดุถึง ${order.shipping?.receiverName ?? ''}`}
                  </span>
                </div>

                <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-200">
                  <span>{order.books.length} เล่ม</span>
                  <span className="font-bold text-[var(--color-primary)]">
                    ฿{order.total.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}

            {isMulti && (
              <div className="px-2 pt-1 flex justify-between text-xs font-bold text-slate-700">
                <span>ยอดรวมทุกออเดอร์</span>
                <span className="text-[var(--color-primary)]">฿{grandTotal.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2.5 pt-6 pb-2 safe-area-bottom">
        <Button
          fullWidth
          size="lg"
          onClick={() =>
            router.push(
              !isMulti && orderIds[0] ? `/orders/${orderIds[0]}` : '/orders'
            )
          }
        >
          {isMulti ? 'ดูรายการคำสั่งซื้อทั้งหมด' : 'ดูสถานะออเดอร์'}
        </Button>
        <Button fullWidth size="lg" variant="outline" onClick={() => router.push('/')}>
          กลับหน้าหลัก
        </Button>
      </div>
    </div>
  );
}
