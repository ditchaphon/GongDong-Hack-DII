'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Toast } from '@/components/ui';
import { HandoverCode, CodeInput } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { ViewRole } from '@/types/v4';
import { ShieldCheck, AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';

export default function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, verifyHandover } = useV4Orders();

  const order = getOrder(resolvedParams.id);
  const [role, setRole] = useState<ViewRole>('BUYER');
  const [code, setCode] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'seller' ? 'SELLER' : 'BUYER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="รหัสรับของ" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้</p>
      </div>
    );
  }

  const done = order.status === 'COMPLETED';

  const handleVerify = () => {
    if (code.length !== 6) {
      setError('กรอกรหัสให้ครบ 6 หลัก');
      return;
    }
    const ok = verifyHandover(order.id, code);
    if (!ok) {
      const left = attemptsLeft - 1;
      setAttemptsLeft(left);
      setError(
        left > 0
          ? `รหัสไม่ถูกต้อง · ลองได้อีก ${left} ครั้ง`
          : 'รหัสไม่ถูกต้องครบ 3 ครั้ง · ให้ผู้ซื้อเปิดรหัสอีกครั้ง'
      );
      return;
    }
    setError(null);
    setToastMessage('ยืนยันรหัสถูกต้อง · ปิดออเดอร์สำเร็จ');
    setTimeout(() => router.push(`/orders/${order.id}?role=seller`), 900);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="รหัสรับของ"
        onBack={() => router.push(`/orders/${order.id}${role === 'SELLER' ? '?role=seller' : ''}`)}
      />

      <div className="p-4 space-y-4">
        {done ? (
          <div className="bg-white rounded-2xl border border-emerald-200 p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[var(--color-primary)] mx-auto" />
            <h1 className="text-sm font-bold text-slate-900">ปิดออเดอร์แล้ว</h1>
            <p className="text-[11px] text-slate-500">
              รหัสรับของถูกใช้ยืนยันเรียบร้อย · แชทอ่านได้อย่างเดียว
            </p>
          </div>
        ) : order.status !== 'SCHEDULED' ? (
          <div className="bg-white rounded-2xl border border-amber-200 p-4 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            รหัสรับของใช้ได้หลังยืนยันนัดแล้วเท่านั้น · สถานะปัจจุบันคือ {order.status}
          </div>
        ) : role === 'BUYER' ? (
          <>
            {order.handoverCode ? (
              <HandoverCode
                code={order.handoverCode}
                verified={!!order.handoverCodeVerifiedAtISO}
                onReveal={() =>
                  setToastMessage('แสดงรหัสหลังตรวจหนังสือและจ่ายเงินแล้วเท่านั้น')
                }
              />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-[11px] text-slate-500">
                ยังไม่มีรหัสสำหรับออเดอร์นี้
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              ตรวจหนังสือว่าตรงเกรดและจ่ายเงินเรียบร้อยก่อน
              แล้วจึงบอกรหัสกับผู้ขาย · ห้ามส่งรหัสในแชทก่อนรับของ
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                <KeyRound className="w-4 h-4 text-[var(--color-primary)]" />
                ขอรหัส 6 หลักจากผู้ซื้อ
              </div>
              <p className="leading-relaxed">
                หลังผู้ซื้อตรวจหนังสือและจ่ายเงินแล้ว · กรอกรหัสเพื่อปิดออเดอร์
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <CodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setError(null);
                }}
                onSubmit={handleVerify}
                error={error || undefined}
                attemptsLeft={attemptsLeft}
                disabled={attemptsLeft === 0}
              />
            </div>
          </>
        )}
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
