'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast, Countdown } from '@/components/ui';
import { QrPayCard, SlipUploader, SlipResult } from '@/components/v4';
import { useSeller } from '@/hooks/useSeller';
import { MOCK_CREDIT_PACKAGES } from '@/mocks/seller';
import { SlipCheckState } from '@/types/v4';
import { Info, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function SellerTopUpPayPage() {
  const router = useRouter();
  const { selectedPackageId, submitTopUp } = useSeller();

  const pkg =
    MOCK_CREDIT_PACKAGES.find((p) => p.id === selectedPackageId) ||
    MOCK_CREDIT_PACKAGES[1];

  const [slipUrl, setSlipUrl] = useState('');
  const [slipState, setSlipState] = useState<SlipCheckState>('NONE');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isChecking = slipState === 'CHECKING';

  const handleSubmit = () => {
    if (!slipUrl) {
      setToastMessage('กรุณาแนบสลิปการโอนเงินก่อนส่ง');
      return;
    }
    setSlipState('CHECKING');
    setToastMessage('กำลังตรวจสลิป · ไม่ต้องปิดหน้านี้');
    setTimeout(() => {
      submitTopUp({ id: pkg.id, credits: pkg.credits, price: pkg.price });
      setSlipState('PASSED');
      setToastMessage('ตรวจสลิปผ่าน · ส่งให้แอดมินอนุมัติ');
      setTimeout(() => router.push('/seller/credits/success'), 900);
    }, 1600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ชำระเงิน · คิวอาร์" onBack={() => router.push('/seller/credits')} />

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center space-y-1">
          <div className="text-[11px] text-slate-400">
            แพ็กเกจ {pkg.name} · {pkg.credits} เครดิต
          </div>
          <div className="text-3xl font-black text-slate-900">฿{pkg.price}</div>
          <div className="text-[11px] text-slate-500">
            ใช้รับออเดอร์ได้ {pkg.credits} ครั้ง
          </div>
        </div>

        <QrPayCard
          amount={pkg.price}
          recipientLabel="กองดอง · บัญชีรับชำระ"
          reference={`TOPUP-${pkg.id.toUpperCase()}`}
          state={isChecking ? 'loading' : 'ready'}
        />

        <Countdown initialSeconds={30 * 60} label="กรุณาโอนและแนบสลิปภายใน" />

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            แนบสลิปการโอนเงิน
          </h3>

          {slipState === 'NONE' || slipState === 'FAILED' ? (
            <>
              <SlipUploader
                previewUrl={slipUrl}
                onChange={(url) => {
                  setSlipUrl(url);
                  setSlipState('NONE');
                }}
                onRemove={() => setSlipUrl('')}
                amountLabel={`฿${pkg.price}`}
                error={slipState === 'FAILED' ? 'สลิปไม่ผ่านการตรวจ ลองแนบใหม่' : undefined}
              />
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  สลิปต้องเห็นยอดเงิน วันเวลา และเลขที่รายการชัดเจน ·
                  ระบบจะปิดข้อมูลส่วนตัวบนสลิปให้อัตโนมัติ
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

        <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-primary)]" />
          <span className="leading-relaxed">
            หลังสลิปผ่าน ระบบส่งให้แอดมินอนุมัติ ·
            เครดิตจะเข้าบัญชีเมื่ออนุมัติแล้วเท่านั้น ไม่เข้าทันที
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            isLoading={isChecking}
            disabled={!slipUrl || slipState === 'PASSED' || isChecking}
            onClick={handleSubmit}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            ส่งสลิปให้แอดมินตรวจสอบ
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
