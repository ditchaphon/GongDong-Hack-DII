'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import { ConfirmSheet } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { ViewRole } from '@/types/v4';
import { MapPin, Clock, AlertTriangle, ShieldCheck, MessageCircle, Lock } from 'lucide-react';

export default function NoShowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    getOrder,
    fetchOrder,
    loading,
    reportMissedMeeting,
    disputeMissedMeeting,
  } = useV4Orders();

  const order = getOrder(resolvedParams.id);

  useEffect(() => {
    if (!order) fetchOrder(resolvedParams.id);
  }, [resolvedParams.id, order, fetchOrder]);

  const [role, setRole] = useState<ViewRole>('SELLER');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rebuttal, setRebuttal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [devBypass, setDevBypass] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'buyer' ? 'BUYER' : 'SELLER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="แจ้งไม่มาตามนัด" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">
          {loading ? 'กำลังโหลดข้อมูลออเดอร์...' : 'ไม่พบออเดอร์นี้'}
        </p>
      </div>
    );
  }

  const alreadyDisputed = order.status === 'DISPUTED';

  // ตรวจสอบเงื่อนไขว่าเลยเวลานัดหมายมาแล้วอย่างน้อย 15 นาทีหรือไม่
  const checkCanReport = () => {
    if (devBypass) return { canReport: true, reportTimeStr: '' };
    if (!order.schedule) return { canReport: true, reportTimeStr: '' };

    try {
      const datePart = order.schedule.dateISO; // e.g. "2026-11-13"
      const timeMatch = order.schedule.timeLabel.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return { canReport: true, reportTimeStr: '' };

      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const scheduledDate = new Date(`${datePart}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);

      // ต้องเลยเวลานัดมาแล้วอย่างน้อย 15 นาที (15 * 60 * 1000 ms)
      const allowedTime = new Date(scheduledDate.getTime() + 15 * 60 * 1000);
      const isAllowed = Date.now() >= allowedTime.getTime();

      const timeStr = `${allowedTime.getHours().toString().padStart(2, '0')}:${allowedTime.getMinutes().toString().padStart(2, '0')} น.`;
      return { canReport: isAllowed, reportTimeStr: timeStr };
    } catch {
      return { canReport: true, reportTimeStr: '' };
    }
  };

  const { canReport, reportTimeStr } = checkCanReport();

  const handleReport = async () => {
    setSubmitting(true);
    const res = await reportMissedMeeting(order.id);
    setSubmitting(false);
    setConfirmOpen(false);
    if (!res.ok) {
      setToastMessage(res.error || 'ส่งรายงานไม่สำเร็จ');
      return;
    }
    setToastMessage('แจ้งไม่มาตามนัดแล้ว · แอดมินจะตรวจสอบและติดต่อทั้งสองฝ่าย');
    setTimeout(() => router.push(`/orders/${order.id}?role=seller`), 900);
  };

  const handleRebuttal = async () => {
    if (rebuttal.trim().length < 5) {
      setToastMessage('เขียนคำชี้แจงอย่างน้อย 5 ตัวอักษร');
      return;
    }
    setSubmitting(true);
    const res = await disputeMissedMeeting(order.id, rebuttal.trim());
    setSubmitting(false);
    if (!res.ok) {
      setToastMessage(res.error || 'ส่งคำชี้แจงไม่สำเร็จ');
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
                <h2 className="text-xs font-bold text-slate-800">เงื่อนไขการแจ้งผู้ซื้อเทนัด (v4 Rule)</h2>
                <p>• สามารถกดแจ้งได้เมื่อ **เลยเวลานัดหมายไปแล้วอย่างน้อย 15 นาที**</p>
                <p>• ต้องรอที่จุดนัดพบอย่างน้อย 15 นาที เพื่อให้โอกาสผู้ซื้อเดินทางมาถึง</p>
                <p>• แนบหลักฐานในแชทออเดอร์ได้ เช่น รูปถ่ายที่จุดนัดหรือข้อความเรียก</p>
                <p>• แอดมินจะส่งแจ้งเตือนให้ผู้ซื้อมีสิทธิ์ชี้แจง/โต้แย้งภายใน 24 ชั่วโมง</p>
              </div>

              {!canReport ? (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>ยังไม่ถึงเวลาที่สามารถแจ้งเรื่องได้</span>
                  </div>
                  <p className="leading-relaxed">
                    ระบบล็อกปุ่มแจ้งไม่มาตามนัดไว้จนกว่าจะเลยเวลานัด 15 นาที (จะสามารถกดแจ้งได้เวลา <strong>{reportTimeStr}</strong> เป็นต้นไป)
                  </p>
                  <div className="pt-1 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setDevBypass(true)}
                      className="text-[10px] text-indigo-600 font-semibold hover:underline"
                    >
                      ⚡ ข้ามเวลา 15 นาทีทันที (สำหรับทดสอบในโหมดเดโม)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  การแจ้งไม่มาตามนัดจะหยุดเวลาออเดอร์ และเข้าสู่การตรวจสอบของแอดมิน
                </div>
              )}

              <Button
                fullWidth
                size="lg"
                variant="outline"
                onClick={() => router.push(`/orders/${order.id}?role=seller`)}
                leftIcon={<MessageCircle className="w-4 h-4" />}
              >
                กลับไปคุยในแชทก่อน
              </Button>

              <Button
                fullWidth
                size="lg"
                disabled={!canReport}
                onClick={() => setConfirmOpen(true)}
              >
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
                  placeholder="อธิบายสถานการณ์ เช่น ไปถึงจุดนัดแล้วแต่หาไม่เจอ หรือติดธุระด่วน"
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
        description="ออเดอร์จะหยุดเวลาและเข้าสู่การตรวจสอบ · ผู้ซื้อจะได้รับโอกาสชี้แจงภายใน 24 ชม."
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
