'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, PhotoUploader, Toast } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { REPORT_REASONS } from '@/mocks/seller';
import {
  AlertTriangle,
  Camera,
  Info,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

export default function SellerReportPage() {
  const router = useRouter();
  const { orders } = useSeller();

  const reportableOrders = orders.filter(
    (o) => o.status !== 'CANCELLED' && o.status !== 'COMPLETED'
  );
  const [orderId, setOrderId] = useState(reportableOrders[0]?.id || orders[0]?.id || '');
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [photo, setPhoto] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOrder = orders.find((o) => o.id === orderId);

  const handleSubmit = () => {
    if (detail.trim().length < 10) {
      setError('อธิบายปัญหาอย่างน้อย 10 ตัวอักษร เพื่อให้แอดมินช่วยได้ตรงจุด');
      return;
    }
    setError(null);
    router.push('/seller/report/sent');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="รายงานปัญหา (S6R)" onBack={() => router.push('/seller/orders')} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                แจ้งปัญหาเรื่องออเดอร์
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                ใช้เมื่อผู้ซื้อไม่มาตามนัด ไม่ชำระเงิน หรือเกิดข้อพิพาทเรื่องสภาพหนังสือ
                แอดมินจะตรวจสอบภายใน 24 ชั่วโมง
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-order" className="text-xs font-semibold text-slate-700">
              เลือกออเดอร์
            </label>
            <select
              id="report-order"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full min-h-[44px] px-3.5 text-sm bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} · {o.buyerName} · {o.books[0]?.title.slice(0, 24)}
                </option>
              ))}
            </select>
            {selectedOrder && (
              <p className="text-[11px] text-slate-400">
                {selectedOrder.deliveryMethod === 'MEETUP'
                  ? `นัดรับ · ${selectedOrder.meetupDetails?.zone}`
                  : 'ส่งพัสดุ'}{' '}
                · ฿{selectedOrder.totalAmount.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Reason */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            สาเหตุของปัญหา
          </h3>
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm text-left transition ${
                reason === r
                  ? 'border-[#06C755] bg-emerald-50/60 text-slate-900 font-semibold'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r}
              {reason === r && <span className="w-2 h-2 rounded-full bg-[#06C755]" />}
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="report-detail" className="text-xs font-semibold text-slate-700">
              อธิบายเหตุการณ์
            </label>
            <textarea
              id="report-detail"
              rows={4}
              value={detail}
              onChange={(e) => {
                setDetail(e.target.value);
                setError(null);
              }}
              placeholder="เช่น นัดรับเวลา 16:30 ที่หน้าหอสมุดกลาง รอ 30 นาที ติดต่อผู้ซื้อไม่ได้"
              className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
            />
            <span className="text-[11px] text-slate-400">
              {detail.trim().length}/10 ตัวอักษรขั้นต่ำ
            </span>
          </div>

          <PhotoUploader
            label="แนบหลักฐาน (ถ้ามี)"
            previewUrl={photo}
            onChange={(url) => {
              setPhoto(url);
              setToastMessage('แนบรูปหลักฐานแล้ว');
            }}
            onRemove={() => setPhoto('')}
            description="ภาพแชท รูปหนังสือ หรือรูปจุดนัด"
          />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span className="leading-relaxed">
            การแจ้งเท็จอาจทำให้บัญชีถูกระงับ · เราจะเก็บข้อมูลนี้เป็นความลับ
            และแจ้งผลให้คุณทราบใน LINE
          </span>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            ถ้าเป็นการนัดรับ ให้ลองโทรหาผู้ซื้ออีกครั้งก่อนแจ้งปัญหา
            ระบบจะเก็บเบอร์โทรไว้ให้ติดต่อได้ตลอด
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={handleSubmit}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ส่งรายงานให้แอดมิน
          </Button>
        </div>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
