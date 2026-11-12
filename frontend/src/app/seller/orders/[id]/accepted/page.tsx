'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Modal, Toast, StatusBadge } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import {
  CheckCircle2,
  Phone,
  MapPin,
  Clock,
  Truck,
  CreditCard,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export default function SellerOrderAcceptedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { orders, credits } = useSeller();
  const { openWindow } = useLiff();

  const order = orders.find((o) => o.id === id) || orders[0];
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMeetup = order.deliveryMethod === 'MEETUP';
  const phone = order.buyerPhone || '086-555-1234';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="รับออเดอร์สำเร็จ" onBack={() => router.push('/seller/orders')} />

      <div className="p-4 space-y-4">
        {/* Success hero */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-[#06C755]" />
          </div>
          <h1 className="text-lg font-black text-slate-900">รับออเดอร์แล้ว (S4B)</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            ใช้ 1 เครดิต · เหลือ {credits} เครดิต · เบอร์โทรผู้ซื้อถูกปลดล็อกแล้ว
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <StatusBadge status={order.status} size="sm" />
            <span className="text-[11px] text-slate-400">#{order.id}</span>
          </div>
        </div>

        {/* Unlocked contact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ช่องทางติดต่อผู้ซื้อ
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              ปลดล็อกแล้ว ✓
            </span>
          </div>

          <div className="flex items-center gap-3">
            {order.buyerAvatar && (
              <img
                src={order.buyerAvatar}
                alt={order.buyerName}
                className="w-11 h-11 rounded-full object-cover bg-slate-100"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800">{order.buyerName}</h4>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{phone}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              fullWidth
              leftIcon={<Phone className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={() => setIsCallOpen(true)}
            >
              โทรหาผู้ซื้อ
            </Button>
            <Button
              size="sm"
              variant="outline"
              fullWidth
              leftIcon={<MessageCircle className="w-3.5 h-3.5 text-sky-600" />}
              onClick={() => {
                setToastMessage('เปิดแชท LINE กับผู้ซื้อ (จำลอง)');
                openWindow('https://line.me/R/oaMessage/@gongdong', true);
              }}
            >
              แชทใน LINE
            </Button>
          </div>

          {order.buyerNote && (
            <div className="p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-600">
              หมายเหตุจากผู้ซื้อ: {order.buyerNote}
            </div>
          )}
        </div>

        {/* Next steps */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ขั้นตอนต่อไป
          </span>

          {isMeetup ? (
            <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2 text-xs text-teal-900">
              <div className="flex items-center gap-2 font-bold">
                <MapPin className="w-4 h-4 text-teal-600" />
                {order.meetupDetails?.zone}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                {order.meetupDetails?.scheduledAt}
              </div>
              <p className="text-[11px] text-teal-700 pt-1 border-t border-teal-200/60 leading-relaxed">
                ผู้ซื้อจ่ายเงินหน้างานหลังตรวจหนังสือ · ไม่ต้องโอนล่วงหน้า
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Truck className="w-4 h-4 text-slate-500" />
                ส่งพัสดุ · ฿{order.shippingFee}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                รอผู้ซื้อโอนและแนบสลิป แล้วจัดส่งภายใน 48 ชั่วโมง
              </p>
              <p className="text-[11px] text-slate-500">
                ที่อยู่:{' '}
                {order.shippingAddress
                  ? `${order.shippingAddress.detail} ${order.shippingAddress.subdistrict} ${order.shippingAddress.district} ${order.shippingAddress.province} ${order.shippingAddress.postalCode}`
                  : 'รอผู้ซื้อกรอกที่อยู่'}
              </p>
            </div>
          )}

          <div className="space-y-2 text-[11px] text-slate-600">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>ถ่ายรูปหนังสือก่อนส่ง/ก่อนนัดรับ เก็บไว้เป็นหลักฐาน</span>
            </div>
            <div className="flex items-start gap-2">
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>เงินจากผู้ซื้อเข้าบัญชีพร้อมเพย์ของคุณโดยตรง ไม่ผ่านระบบ</span>
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>หนังสือ ({order.books.length} เล่ม)</span>
            <span className="font-semibold text-slate-800">
              ฿{order.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ค่าส่ง</span>
            <span className="font-semibold text-slate-800">
              {order.shippingFee === 0 ? '฿0 (นัดรับ)' : `฿${order.shippingFee}`}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-900">ยอดรวม</span>
            <span className="text-lg font-black text-[#06C755]">
              ฿{order.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={() => router.push(`/seller/meetup/${order.id}`)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            {isMeetup ? 'ไปหน้านัดรับ / ปิดการขาย (S6)' : 'ไปหน้าจัดส่งพัสดุ'}
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        title={`โทรหา ${order.buyerName}`}
        description={`ต้องการโทรออกไปยังเบอร์ ${phone} ใช่หรือไม่?`}
        confirmText="โทรออก"
        onConfirm={() => {
          setIsCallOpen(false);
          window.location.href = `tel:${phone.replace(/\D/g, '')}`;
        }}
      />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
