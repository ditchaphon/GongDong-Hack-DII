'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import {
  CheckCircle2,
  Wallet,
  Package,
  Plus,
  Store,
  Star,
  Info,
} from 'lucide-react';

export default function SellerSaleClosedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { orders } = useSeller();

  const order = orders.find((o) => o.id === id) || orders[0];
  const isMeetup = order.deliveryMethod === 'MEETUP';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-7 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#06C755]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">ปิดการขายสำเร็จ (S7)</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          ขอบคุณที่ขายกับกองดอง · เงินค่าหนังสือเป็นของคุณทั้งหมด ไม่มีค่ากลาง
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Earnings */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-50">
            <Wallet className="w-4 h-4" />
            {isMeetup ? 'รับเงินหน้างานแล้ว' : 'ยอดที่ผู้ซื้อโอนให้'}
          </div>
          <div className="text-3xl font-black">
            ฿{order.totalAmount.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-50/90 pt-1">
            {isMeetup
              ? 'เงินสด/พร้อมเพย์หน้างาน · ไม่ผ่านระบบพักเงิน'
              : 'โอนเข้าพร้อมเพย์ของคุณโดยตรง'}
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            สรุปออเดอร์ #{order.id}
          </span>

          <div className="flex gap-3">
            <div className="w-12 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
              <img
                src={order.books[0]?.photos.cover}
                alt={order.books[0]?.title || ''}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">
                {order.books[0]?.title}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {order.books.length > 1
                  ? `รวม ${order.books.length} เล่ม`
                  : '1 เล่ม'}{' '}
                · ผู้ซื้อ {order.buyerName}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isMeetup
                  ? `นัดรับ · ${order.meetupDetails?.zone}`
                  : `ส่งพัสดุ · ${order.trackingNumber || 'ไม่มีเลขพัสดุ'}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-50">
              <div className="text-slate-400">เครดิตที่ใช้</div>
              <div className="font-bold text-slate-800">1 เครดิต</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50">
              <div className="text-slate-400">สถานะ</div>
              <div className="font-bold text-emerald-700">สำเร็จแล้ว ✓</div>
            </div>
          </div>
        </div>

        {/* Rating hint */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Star className="w-4 h-4 text-amber-500" />
            ผู้ซื้อจะให้คะแนนคุณ
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            คะแนนและรีวิวจะแสดงบนร้านของคุณ ช่วยให้ขายครั้งต่อไปเร็วขึ้น
          </p>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            เก็บรูปถ่ายตอนส่งมอบไว้อย่างน้อย 7 วัน เผื่อมีข้อพิพาทเรื่องสภาพหนังสือ
          </span>
        </div>

        <div className="space-y-2 pt-1">
          <Button
            fullWidth
            size="lg"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => router.push('/seller/list')}
          >
            ลงขายเล่มต่อไป
          </Button>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<Store className="w-4 h-4" />}
            onClick={() => router.push('/seller')}
          >
            กลับไปที่ร้านของฉัน
          </Button>
          <button
            type="button"
            onClick={() => router.push('/seller/orders')}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            <Package className="w-3.5 h-3.5" />
            ดูออเดอร์ทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}
