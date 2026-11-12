'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  Chip,
  StatusBadge,
  BottomSheet,
  Toast,
  EmptyState,
} from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { SellerOrder } from '@/types';
import {
  MapPin,
  Truck,
  Phone,
  CreditCard,
  MessageCircle,
  Package,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

type Tab = 'NEW' | 'ACTIVE' | 'DONE';

const REJECT_REASONS = [
  'หนังสือถูกขายไปแล้ว',
  'ไม่สะดวกส่ง/นัดรับในช่วงนี้',
  'ราคาที่ตั้งไว้ผิด',
  'อื่น ๆ',
];

export default function SellerOrdersPage() {
  const router = useRouter();
  const { orders, credits, acceptOrder, rejectOrder } = useSeller();

  const [tab, setTab] = useState<Tab>('NEW');
  const [acceptTarget, setAcceptTarget] = useState<SellerOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SellerOrder | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [isAccepting, setIsAccepting] = useState(false);
  const [noCreditOpen, setNoCreditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const newOrders = orders.filter((o) => o.status === 'PENDING_ACCEPT');
  const activeOrders = orders.filter(
    (o) =>
      o.status === 'WAITING_PAYMENT' ||
      o.status === 'PAYMENT_SUBMITTED' ||
      o.status === 'PREPARING_SHIPPING' ||
      o.status === 'SHIPPED' ||
      o.status === 'MEETUP_CONFIRMED'
  );
  const doneOrders = orders.filter(
    (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
  );

  const visible =
    tab === 'NEW' ? newOrders : tab === 'ACTIVE' ? activeOrders : doneOrders;

  const handleAccept = () => {
    if (!acceptTarget) return;
    setIsAccepting(true);
    setTimeout(() => {
      const result = acceptOrder(acceptTarget.id);
      setIsAccepting(false);
      if (!result.success) {
        setAcceptTarget(null);
        setNoCreditOpen(true);
        return;
      }
      const id = acceptTarget.id;
      setAcceptTarget(null);
      router.push(`/seller/orders/${id}/accepted`);
    }, 600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar title="ออเดอร์ของฉัน (ผู้ขาย)" onBack={() => router.push('/seller')} />

      {/* Credit balance */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-700" />
            <div>
              <div className="text-[11px] text-emerald-800">เครดิตคงเหลือ</div>
              <div className="text-base font-black text-emerald-900">
                {credits} เครดิต
              </div>
            </div>
          </div>
          <Link
            href="/seller/credits"
            className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-50"
          >
            เติมเครดิต
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4">
        <Chip
          label="คำขอใหม่"
          selected={tab === 'NEW'}
          count={newOrders.length}
          onClick={() => setTab('NEW')}
          size="sm"
        />
        <Chip
          label="กำลังดำเนินการ"
          selected={tab === 'ACTIVE'}
          count={activeOrders.length}
          onClick={() => setTab('ACTIVE')}
          size="sm"
        />
        <Chip
          label="จบแล้ว"
          selected={tab === 'DONE'}
          onClick={() => setTab('DONE')}
          size="sm"
        />
      </div>

      <div className="px-4 space-y-3 flex-1">
        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 mt-2">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-400" />}
              title="ยังไม่มีออเดอร์ในหมวดนี้"
              description="เมื่อผู้ซื้อส่งคำขอซื้อ คุณจะเห็นรายละเอียดที่นี่และได้รับแจ้งเตือนใน LINE"
              actionText="ไปที่ร้านของฉัน"
              onAction={() => router.push('/seller')}
            />
          </div>
        ) : (
          visible.map((order) => {
            const isMeetup = order.deliveryMethod === 'MEETUP';
            const isNew = order.status === 'PENDING_ACCEPT';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    {order.buyerAvatar && (
                      <img
                        src={order.buyerAvatar}
                        alt={order.buyerName}
                        className="w-7 h-7 rounded-full object-cover bg-slate-100"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {order.buyerName}
                      </div>
                      <div className="text-[10px] text-slate-400">#{order.id}</div>
                    </div>
                  </div>
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
                    <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {order.books[0]?.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {order.books.length > 1
                        ? `และอีก ${order.books.length - 1} เล่ม`
                        : '1 เล่ม'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                      {isMeetup ? (
                        <span className="inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3" />
                          {order.meetupDetails?.zone}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          <Truck className="w-3 h-3" />
                          ส่งพัสดุ · ฿{order.shippingFee}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-400">ยอดรับ</div>
                    <div className="text-sm font-black text-slate-900">
                      ฿{order.totalAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {order.buyerNote && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-600">
                    <MessageCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                    <span>{order.buyerNote}</span>
                  </div>
                )}

                {isNew ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      onClick={() => {
                        setRejectTarget(order);
                        setRejectReason(REJECT_REASONS[0]);
                      }}
                    >
                      ปฏิเสธ
                    </Button>
                    <Button size="sm" fullWidth onClick={() => setAcceptTarget(order)}>
                      รับออเดอร์ (-1 เครดิต)
                    </Button>
                  </div>
                ) : order.status === 'WAITING_PAYMENT' || order.status === 'PAYMENT_SUBMITTED' ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/seller/meetup/${order.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs font-bold text-emerald-800"
                  >
                    {isMeetup ? 'ไปหน้านัดรับ / ปิดการขาย' : 'ดูรายละเอียดการจัดส่ง'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/seller/meetup/${order.id}`)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600"
                  >
                    ดูรายละเอียดออเดอร์
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* S4A — confirm using 1 credit */}
      <BottomSheet
        isOpen={!!acceptTarget}
        onClose={() => setAcceptTarget(null)}
        title="ยืนยันรับออเดอร์ (S4A)"
        footer={
          <Button
            fullWidth
            size="lg"
            isLoading={isAccepting}
            disabled={credits < 1}
            onClick={handleAccept}
          >
            ใช้ 1 เครดิต และรับออเดอร์
          </Button>
        }
      >
        {acceptTarget && (
          <div className="space-y-4 py-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">ผู้ซื้อ</span>
                <span className="font-semibold text-slate-800">
                  {acceptTarget.buyerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">หนังสือ</span>
                <span className="font-semibold text-slate-800">
                  {acceptTarget.books.length} เล่ม
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">วิธีรับ</span>
                <span className="font-semibold text-slate-800">
                  {acceptTarget.deliveryMethod === 'MEETUP'
                    ? 'นัดรับใน มช. (ฟรี)'
                    : `ส่งพัสดุ · ฿${acceptTarget.shippingFee}`}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800">ยอดรวม</span>
                <span className="font-black text-[#06C755]">
                  ฿{acceptTarget.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1.5 text-[11px] text-amber-900">
              <div className="flex items-center gap-1.5 font-bold">
                <CreditCard className="w-4 h-4" />
                ใช้ 1 เครดิตจาก {credits} เครดิต
              </div>
              <p className="leading-relaxed">
                เมื่อรับแล้ว ค่าคอมมิชชัน 1 เครดิตจะถูกหักทันที และคุณจะเห็นเบอร์โทร +
                จุดนัดของผู้ซื้อเพื่อติดต่อกลับ
              </p>
            </div>

            {credits < 1 && (
              <button
                type="button"
                onClick={() => {
                  setAcceptTarget(null);
                  router.push('/seller/credits');
                }}
                className="w-full p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700"
              >
                เครดิตไม่พอ · ไปเติมเครดิต
              </button>
            )}
          </div>
        )}
      </BottomSheet>

      {/* REJECT — reject order */}
      <BottomSheet
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="ปฏิเสธออเดอร์ (REJECT)"
        footer={
          <Button
            fullWidth
            size="lg"
            variant="danger"
            onClick={() => {
              if (rejectTarget) rejectOrder(rejectTarget.id);
              setRejectTarget(null);
              setToastMessage('ปฏิเสธออเดอร์แล้ว · ไม่เสียเครดิต');
            }}
          >
            ยืนยันปฏิเสธ
          </Button>
        }
      >
        <div className="space-y-2 py-1">
          <p className="text-xs text-slate-500 leading-relaxed pb-1">
            การปฏิเสธไม่เสียเครดิต ผู้ซื้อจะได้รับแจ้งเตือนและสามารถเลือกหนังสือเล่มอื่นได้
          </p>
          {REJECT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setRejectReason(reason)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm text-left transition ${
                rejectReason === reason
                  ? 'border-[#06C755] bg-emerald-50/60 text-slate-900 font-semibold'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {reason}
              {rejectReason === reason && (
                <span className="w-2 h-2 rounded-full bg-[#06C755]" />
              )}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Insufficient credit modal state */}
      {noCreditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="ปิด"
            onClick={() => setNoCreditOpen(false)}
            className="fixed inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 space-y-3 z-10">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">เครดิตไม่พอ</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              การรับออเดอร์ใช้ 1 เครดิต เติมเครดิตแล้วกลับมารับออเดอร์นี้ได้ทันที
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" fullWidth onClick={() => setNoCreditOpen(false)}>
                ไว้ก่อน
              </Button>
              <Button fullWidth onClick={() => router.push('/seller/credits')}>
                เติมเครดิต
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
