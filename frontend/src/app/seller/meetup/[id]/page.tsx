'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  Modal,
  StatusBadge,
  Toast,
  Countdown,
} from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import {
  MapPin,
  Clock,
  Phone,
  Share2,
  CheckCircle2,
  Truck,
  Package,
  AlertTriangle,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

export default function SellerMeetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { orders, closeSale } = useSeller();
  const { shareTargetPicker } = useLiff();

  const order = orders.find((o) => o.id === id) || orders[0];
  const isMeetup = order.deliveryMethod === 'MEETUP';
  const isCompleted = order.status === 'COMPLETED';

  const [isCallOpen, setIsCallOpen] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const phone = order.buyerPhone || '086-555-1234';

  const handleShare = async () => {
    const text = `นัดรับหนังสือ: ${order.meetupDetails?.zone} · ${order.meetupDetails?.scheduledAt} (ออเดอร์ #${order.id})`;
    const shared = await shareTargetPicker([{ type: 'text', text }]);
    if (!shared) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // clipboard may be blocked inside LINE
      }
    }
    setToastMessage('คัดลอกข้อความนัดรับแล้ว (TSHARE)');
  };

  const handleCloseSale = () => {
    closeSale(order.id);
    setIsCloseOpen(false);
    router.push(`/seller/meetup/${order.id}/closed`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title={isMeetup ? 'วันนัดรับ · ปิดการขาย' : 'จัดส่งพัสดุ'}
        onBack={() => router.push('/seller/orders')}
      />

      <div className="p-4 space-y-4">
        {/* Order header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">ออเดอร์ #{order.id}</span>
            <StatusBadge status={order.status} size="sm" />
          </div>
          <div className="flex gap-3">
            <div className="w-12 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
              <img
                src={order.books[0]?.photos.cover}
                alt={order.books[0]?.title || ''}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                {order.books[0]?.title}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {order.books.length > 1
                  ? `และอีก ${order.books.length - 1} เล่ม`
                  : '1 เล่ม'}{' '}
                · ผู้ซื้อ {order.buyerName}
              </p>
              <p className="text-base font-black text-[#06C755] mt-1">
                ฿{order.totalAmount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Buyer contact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ติดต่อผู้ซื้อ
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              ปลดล็อกแล้ว ✓
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800">{order.buyerName}</h4>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{phone}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Phone className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={() => setIsCallOpen(true)}
            >
              โทรออก
            </Button>
          </div>
        </div>

        {/* Meetup / parcel detail */}
        {isMeetup ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              รายละเอียดนัดรับ (S6)
            </span>
            <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2 text-xs text-teal-900">
              <div className="flex items-center gap-2 font-bold">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                {order.meetupDetails?.zone}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                {order.meetupDetails?.scheduledAt}
              </div>
              {order.meetupDetails?.note && (
                <div className="pt-1.5 text-[11px] text-teal-700 border-t border-teal-200/60">
                  จุดสังเกต: {order.meetupDetails.note}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              fullWidth
              leftIcon={<Share2 className="w-4 h-4" />}
              onClick={handleShare}
            >
              แชร์จุดนัดให้ผู้ซื้อ
            </Button>

            <div className="space-y-2 text-[11px] text-slate-600">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>ให้ผู้ซื้อตรวจสภาพหนังสือก่อนจ่ายเงินทุกครั้ง</span>
              </div>
              <div className="flex items-start gap-2">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>รับเงินสด หรือโอนพร้อมเพย์หน้างาน · ไม่มีระบบพักเงิน</span>
              </div>
              <div className="flex items-start gap-2">
                <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>ถ่ายรูปตอนส่งมอบ เก็บไว้เป็นหลักฐานกันข้อพิพาท</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              การจัดส่งพัสดุ
            </span>

            <Countdown initialSeconds={48 * 3600} label="ต้องส่งภายใน 48 ชม." />

            {order.slipUrl && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-500">สลิปจากผู้ซื้อ</div>
                <img
                  src={order.slipUrl}
                  alt="สลิปโอนเงิน"
                  className="w-full rounded-xl border border-slate-200 object-cover max-h-52"
                />
                <div className="text-[11px] text-emerald-700 font-semibold">
                  ✓ ตรวจสลิปแล้ว · ยอด ฿{order.totalAmount.toLocaleString()}
                </div>
              </div>
            )}

            {order.shippingAddress && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">
                  {order.shippingAddress.fullName} · {order.shippingAddress.phone}
                </div>
                <p className="leading-relaxed">
                  {order.shippingAddress.detail} {order.shippingAddress.subdistrict}{' '}
                  {order.shippingAddress.district} {order.shippingAddress.province}{' '}
                  {order.shippingAddress.postalCode}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="tracking-number"
                className="text-xs font-semibold text-slate-700"
              >
                เลขพัสดุ
              </label>
              <div className="flex gap-2">
                <input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="เช่น TH0123456789CM"
                  className="flex-1 min-h-[44px] px-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setToastMessage('บันทึกเลขพัสดุแล้ว · ผู้ซื้อจะได้รับแจ้งเตือน')}
                >
                  บันทึก
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                แจ้งเลขพัสดุให้ผู้ซื้อเพื่อติดตามพัสดุได้ตลอด
              </p>
            </div>
          </div>
        )}

        {!isCompleted && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => router.push('/seller/report')}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-500 hover:underline"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              รายงานปัญหา (S6R)
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 text-center">
            ขายสำเร็จแล้ว ✓ ปิดการขายเรียบร้อย
          </div>
        )}
      </div>

      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
            <Button
              fullWidth
              size="lg"
              onClick={() => setIsCloseOpen(true)}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              ปิดการขาย · ได้รับเงินแล้ว
            </Button>
          </div>
        </div>
      )}

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

      <Modal
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        title="ยืนยันปิดการขาย?"
        description={
          isMeetup
            ? 'ผู้ซื้อได้รับหนังสือและชำระเงินเรียบร้อยแล้ว การปิดการขายจะทำให้ออเดอร์นี้สิ้นสุด'
            : 'ผู้ซื้อได้รับหนังสือและตรวจสอบแล้ว การปิดการขายจะทำให้ออเดอร์นี้สิ้นสุด'
        }
        confirmText="ปิดการขายสำเร็จ"
        onConfirm={handleCloseSale}
      >
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">ยอดที่ได้รับ</span>
            <span className="font-black text-[#06C755]">
              ฿{order.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">เครดิตที่ใช้</span>
            <span className="font-semibold text-slate-800">1 เครดิต</span>
          </div>
        </div>
      </Modal>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
