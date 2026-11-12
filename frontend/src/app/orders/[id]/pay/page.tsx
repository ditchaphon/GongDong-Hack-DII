'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast, Countdown } from '@/components/ui';
import { QrPayCard, SlipUploader, SlipResult } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { SlipCheckState } from '@/types/v4';
import { Info, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function OrderPayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { getOrder, markPaid } = useV4Orders();

  const order = getOrder(resolvedParams.id);

  const [slipUrl, setSlipUrl] = useState('');
  const [slipState, setSlipState] = useState<SlipCheckState>('NONE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ชำระเงิน" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้</p>
      </div>
    );
  }

  const isChecking = slipState === 'CHECKING';
  const canPay = order.delivery === 'PARCEL' && order.status === 'ACCEPTED';

  const handleSubmit = () => {
    if (!slipUrl) {
      setToastMessage('กรุณาแนบสลิปการโอนเงินก่อนส่ง');
      return;
    }
    setSlipState('CHECKING');
    setTimeout(() => {
      setSlipState('PASSED');
      markPaid(order.id);
      setToastMessage('ตรวจสลิปผ่าน · ผู้ขายเริ่มแพ็คของได้แล้ว');
      setTimeout(() => router.push(`/orders/${order.id}`), 900);
    }, 1600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title="ชำระเงินในออเดอร์"
        onBack={() => router.push(`/orders/${order.id}`)}
      />

      <div className="p-4 space-y-4">
        {!canPay ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              ออเดอร์นี้ไม่ได้อยู่ในขั้นชำระเงินผ่านคิวอาร์
              {order.delivery === 'MEETUP'
                ? ' · ออเดอร์นัดรับจ่ายเงินหน้างานหลังตรวจหนังสือ'
                : ` · สถานะปัจจุบันคือ ${order.status}`}
            </span>
          </div>
        ) : (
          <>
            <QrPayCard
              amount={order.total}
              recipientLabel={`${order.shop.shopName} · ผู้ขาย`}
              reference={order.id}
              state={isChecking ? 'loading' : 'ready'}
            />

            <Countdown initialSeconds={24 * 3600} label="กรุณาชำระและแนบสลิปภายใน" />

            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                แนบสลิปการโอนเงิน
              </h2>

              {slipState === 'NONE' || slipState === 'FAILED' ? (
                <>
                  <SlipUploader
                    previewUrl={slipUrl}
                    onChange={(url) => {
                      setSlipUrl(url);
                      setSlipState('NONE');
                    }}
                    onRemove={() => setSlipUrl('')}
                    amountLabel={`฿${order.total}`}
                    error={
                      slipState === 'FAILED' ? 'สลิปไม่ผ่านการตรวจ ลองแนบใหม่' : undefined
                    }
                  />
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      ตรวจชื่อผู้รับในแอปธนาคารให้ตรงกับร้านก่อนกดโอน ·
                      ห้ามโอนเข้าบัญชีที่ส่งมาทางแชท
                    </span>
                  </div>
                </>
              ) : (
                <SlipResult
                  state={slipState === 'PASSED' ? 'PASSED' : 'CHECKING'}
                  onRetry={() => {
                    setSlipState('NONE');
                    setSlipUrl('');
                  }}
                  onContactAdmin={() => router.push('/help')}
                />
              )}
            </div>

            <p className="flex items-start gap-1.5 text-[10px] text-slate-500 px-1 leading-relaxed">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
              กองดองไม่พักเงิน · เงินโอนตรงผู้ขาย ·
              สลิปถูกเก็บแบบส่วนตัว ไม่แสดงลิงก์สาธารณะ
            </p>
          </>
        )}
      </div>

      {canPay && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
          <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
            <Button
              fullWidth
              size="lg"
              isLoading={isChecking}
              disabled={!slipUrl || isChecking || slipState === 'PASSED'}
              onClick={handleSubmit}
            >
              ส่งสลิปให้ผู้ขายตรวจ
            </Button>
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
