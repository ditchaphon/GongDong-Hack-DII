'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  StatusBadge,
  Modal,
  BottomSheet,
  Toast,
  Countdown,
  PhotoUploader,
} from '@/components/ui';
import { MOCK_ORDERS } from '@/mocks/books';
import { Order } from '@/types';
import {
  Phone,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const order = MOCK_ORDERS.find((o) => o.id === resolvedParams.id) || MOCK_ORDERS[0];

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isSlipSheetOpen, setIsSlipSheetOpen] = useState(false);
  const [uploadedSlip, setUploadedSlip] = useState<string>('');
  const [isSlipSent, setIsSlipSent] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isMeetup = order.deliveryMethod === 'MEETUP';
  const isAccepted = order.status !== 'PENDING_ACCEPT';

  const handleUploadSlip = () => {
    setIsSlipSent(true);
    setIsSlipSheetOpen(false);
    setToastMessage('แนบสลิปโอนเงินเรียบร้อยแล้ว (B5S) ✓');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <TopBar title={`ออเดอร์ #${order.id}`} />

      <div className="p-4 space-y-4">
        {/* Status Stepper Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-400">สถานะปัจจุบัน</span>
              <div className="mt-1">
                <StatusBadge status={order.status} size="md" />
              </div>
            </div>
            <span className="text-xs text-slate-400">{order.createdAt}</span>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                ✓
              </div>
              <div>
                <span className="font-bold text-slate-800">ส่งคำขอซื้อแล้ว</span>
                <p className="text-[11px] text-slate-400">ผู้ซื้อเลือกวิธีรับและส่งคำขอ</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                  isAccepted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isAccepted ? '✓' : '2'}
              </div>
              <div>
                <span className="font-bold text-slate-800">ผู้ขายรับออเดอร์แล้ว (-1 เครดิต)</span>
                <p className="text-[11px] text-slate-400">
                  {isAccepted
                    ? 'ผู้ขายยืนยันออเดอร์แล้ว ปลดล็อกเบอร์โทรติดต่อ'
                    : 'กำลังรอผู้ขายกดยืนยัน'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 ${
                  order.status === 'COMPLETED'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {order.status === 'COMPLETED' ? '✓' : '3'}
              </div>
              <div>
                <span className="font-bold text-slate-800">
                  {isMeetup ? 'นัดรับของและตรวจสอบสภาพ' : 'จัดส่งพัสดุ'}
                </span>
                <p className="text-[11px] text-slate-400">
                  {isMeetup
                    ? 'เจอกันตามจุดนัด ตรวจหนังสือตัวจริงก่อนจ่ายเงิน'
                    : 'รอผู้ขายจัดส่งภายใน 48 ชม.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SLA Timer */}
        <Countdown
          initialSeconds={48 * 3600}
          label="เวลานัดพบ / จัดส่งที่กำหนด:"
        />

        {/* Seller Contact Card (Unlocked after accept!) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ช่องทางติดต่อผู้ขาย
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              ปลดล็อกแล้ว ✓
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-sm">ร้านป้าหนอนหนังสือ</h4>
              <p className="text-xs font-mono text-slate-500 mt-0.5">089-765-4321</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Phone className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={() => setIsCallModalOpen(true)}
            >
              โทรออก
            </Button>
          </div>
        </div>

        {/* Delivery Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 text-xs">
          <span className="font-bold text-slate-400 uppercase tracking-wider">
            รายละเอียดการนัดหมาย / จัดส่ง
          </span>

          {isMeetup ? (
            <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2 text-teal-900">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-bold">
                  จุดนัดพบ: {order.meetupDetails?.zone || 'หน้าหอสมุดกลาง มช.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>เวลานัด: {order.meetupDetails?.scheduledAt || 'วันศุกร์ 13 พ.ย. 16:30 น.'}</span>
              </div>
              {order.meetupDetails?.note && (
                <div className="pt-1 text-[11px] text-teal-700 border-t border-teal-200/50">
                  หมายเหตุ: {order.meetupDetails.note}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">ส่งพัสดุ (Flash Express)</span>
                {order.trackingNumber && (
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {order.trackingNumber}
                  </span>
                )}
              </div>
              <p className="text-slate-500 leading-snug">
                ที่อยู่: {order.shippingAddress?.detail || 'หอพักนักศึกษา มช.'}
              </p>
            </div>
          )}

          {/* If Parcel and waiting for slip */}
          {!isMeetup && order.status === 'WAITING_PAYMENT' && !isSlipSent && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="font-bold text-amber-900">กรุณาแนบสลิปโอนเงิน (B5P)</div>
              <p className="text-amber-700 text-[11px]">
                โอนเงินไปยังพร้อมเพย์ผู้ขาย แล้วแนบสลิปเพื่อให้ผู้ขายเริ่มแพ็คของ
              </p>
              <Button
                size="sm"
                fullWidth
                onClick={() => setIsSlipSheetOpen(true)}
              >
                แนบสลิปโอนเงิน
              </Button>
            </div>
          )}

          {isSlipSent && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
              ✓ ส่งสลิปให้ผู้ขายแล้ว (รอจัดส่งพัสดุ)
            </div>
          )}
        </div>

        {/* Ordered Books list */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            รายการหนังสือในออเดอร์ ({order.books.length} เล่ม)
          </span>
          <div className="divide-y divide-slate-100">
            {order.books.map((b) => (
              <div key={b.id} className="py-2.5 flex justify-between items-center text-xs">
                <div className="flex gap-2.5 items-center">
                  <img src={b.photos.cover} alt="" className="w-10 h-14 rounded object-cover bg-slate-100" />
                  <div>
                    <h5 className="font-semibold text-slate-800 line-clamp-1">{b.title}</h5>
                    <span className="text-slate-400 text-[11px]">เกรด {b.grade}</span>
                  </div>
                </div>
                <span className="font-bold text-slate-900">฿{b.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-800">ยอดรวมทั้งสิ้น</span>
            <span className="text-lg font-black text-[#06C755]">
              ฿{order.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Cancel order CTA */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="text-xs text-rose-500 font-medium hover:underline"
          >
            ขอยกเลิกคำสั่งซื้อนี้
          </button>
        </div>
      </div>

      {/* Fixed Complete Order Button (leads to B8) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={() => router.push(`/orders/${order.id}/review`)}
          >
            ได้รับหนังสือแล้ว (ให้คะแนนร้านค้า)
          </Button>
        </div>
      </div>

      {/* Call Confirmation Dialog (CALL in Figma 28:2218) */}
      <Modal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        title="โทรหาผู้ขาย"
        description="คุณต้องการโทรออกไปยังเบอร์ 089-765-4321 (ร้านป้าหนอนหนังสือ) ใช่หรือไม่?"
        confirmText="โทรออก"
        onConfirm={() => {
          setIsCallModalOpen(false);
          window.location.href = 'tel:0897654321';
        }}
      />

      {/* Cancel Order Confirmation Modal (CANCEL in Figma 28:2208) */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="ยืนยันการยกเลิกคำขอซื้อ?"
        description="หากยกเลิก คำขอจะถูกระงับ และระบบจะคืนสถานะให้หนังสือกลับมาวางขายตามปกติ"
        confirmText="ยืนยันยกเลิก"
        confirmVariant="danger"
        onConfirm={() => {
          setIsCancelModalOpen(false);
          setToastMessage('ยกเลิกออเดอร์เรียบร้อยแล้ว');
          setTimeout(() => router.push('/orders'), 1000);
        }}
      />

      {/* Attach Slip BottomSheet (B5P in Figma 28:392) */}
      <BottomSheet
        isOpen={isSlipSheetOpen}
        onClose={() => setIsSlipSheetOpen(false)}
        title="แนบสลิปการโอนเงิน (B5P)"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!uploadedSlip}
            onClick={handleUploadSlip}
          >
            ส่งสลิปให้ผู้ขาย
          </Button>
        }
      >
        <div className="space-y-4 py-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
            <div className="text-slate-500">บัญชีพร้อมเพย์ผู้ขาย:</div>
            <div className="font-mono font-bold text-slate-800 text-sm">089-765-4321</div>
            <div className="text-emerald-700 font-semibold">ชื่อบัญชี: สมศรี หนอนหนังสือ ✓</div>
            <div className="text-slate-500 pt-1 border-t border-slate-200">
              ยอดที่ต้องโอน: <span className="font-bold text-[#06C755]">฿{order.totalAmount}</span>
            </div>
          </div>

          <PhotoUploader
            label="รูปภาพสลิปการโอนเงิน"
            isRequired
            previewUrl={uploadedSlip}
            onChange={(url) => setUploadedSlip(url)}
            onRemove={() => setUploadedSlip('')}
            description="อัปโหลดสลิปที่เห็นยอดเงินและวันเวลาชัดเจน"
          />
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}

