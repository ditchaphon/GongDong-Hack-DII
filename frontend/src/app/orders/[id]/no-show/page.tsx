'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { ConfirmSheet } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { ViewRole } from '@/types/v4';
import { MapPin, Clock, AlertTriangle, ShieldCheck, MessageCircle } from 'lucide-react';

export default function NoShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, openDispute } = useV4Orders();

  const order = getOrder(resolvedParams.id);
  const [role, setRole] = useState<ViewRole>('SELLER');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rebuttal, setRebuttal] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'buyer' ? 'BUYER' : 'SELLER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="แจ้งไม่มาตามนัด" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้</p>
      </div>
    );
  }

  const alreadyDisputed = order.status === 'DISPUTED';

  const handleReport = () => {
    openDispute(order.id, 'ผู้ซื้อไม่มาตามนัด', 'SELLER');
    setConfirmOpen(false);
    setToastMessage('แจ้งไม่มาตามนัดแล้ว · แอดมินจะตรวจสอบและติดต่อทั้งสองฝ่าย');
    setTimeout(() => router.push(`/orders/${order.id}?role=seller`), 900);
  };

  const handleRebuttal = () => {
    if (rebuttal.trim().length < 5) {
      setToastMessage('เขียนคำชี้แจงอย่างน้อย 5 ตัวอักษร');
      return;
    }
    setToastMessage('ส่งคำชี้แจงให้แอดมินแล้ว');
    setRebuttal('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="แจ้งไม่มาตามนัด"
        onBack={() => router.push(`/orders/${order.id}${role === 'SELLER' ? '?role=seller' : ''}`)}
      />

      <div className="p-4 space-y-4">
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
          </div>
        )}

        {role === 'SELLER' ? (
          alreadyDisputed ? (
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              แจ้งเรื่องนี้แล้ว · แอดมินกำลังตรวจสอบ เวลาทั้งหมดหยุดชั่วคราว
              และจะติดต่อทั้งสองฝ่าย
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-[11px] text-slate-600 leading-relaxed">
                <h2 className="text-xs font-bold text-slate-800">เงื่อนไขการแจ้ง</h2>
                <p>• แจ้งได้หลังเวลานัดผ่านไป 15 นาที</p>
                <p>• ต้องรออย่างน้อย 15 นาทีที่จุดนัดก่อนแจ้ง</p>
                <p>• แนบหลักฐานในแชทออเดอร์ได้ เช่น รูปที่จุดนัดหรือข้อความ</p>
                <p>• แอดมินจะเปิดให้ผู้ซื้อชี้แจงภายใน 24 ชั่วโมง</p>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                การแจ้งไม่มาตามนัดจะหยุดเวลาออเดอร์ และเข้าสู่การตรวจสอบของแอดมิน
              </div>

              <Button
                fullWidth
                size="lg"
                variant="outline"
                onClick={() => router.push(`/orders/${order.id}?role=seller`)}
                leftIcon={<MessageCircle className="w-4 h-4" />}
              >
                กลับไปคุยในแชทก่อน
              </Button>
              <Button fullWidth size="lg" onClick={() => setConfirmOpen(true)}>
                แจ้งผู้ซื้อไม่มาตามนัด
              </Button>
            </>
          )
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-amber-200 p-4 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {alreadyDisputed && order.dispute
                ? `ผู้ขายแจ้งว่า: ${order.dispute.reason} · คุณสามารถชี้แจงได้ด้านล่าง`
                : 'ยังไม่มีการแจ้งปัญหาจากผู้ขาย'}
            </div>

            {alreadyDisputed && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <label htmlFor="rebuttal" className="text-xs font-bold text-slate-800">
                  คำชี้แจงของคุณ
                </label>
                <textarea
                  id="rebuttal"
                  rows={4}
                  value={rebuttal}
                  onChange={(event) => setRebuttal(event.target.value)}
                  placeholder="อธิบายสถานการณ์ เช่น ไปถึงจุดนัดแล้วแต่หาไม่เจอ"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)]"
                />
                <Button fullWidth onClick={handleRebuttal}>
                  ส่งคำชี้แจงให้แอดมิน
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmSheet
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="ยืนยันแจ้งไม่มาตามนัด?"
        description="ออเดอร์จะหยุดเวลาและเข้าสู่การตรวจสอบ · ผู้ซื้อจะได้รับโอกาสชี้แจง"
        confirmLabel="ยืนยันแจ้งเรื่อง"
        tone="danger"
        onConfirm={handleReport}
      />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
