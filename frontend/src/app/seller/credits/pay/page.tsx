'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast, Countdown } from '@/components/ui';
import { QrPayCard, SlipUploader, SlipResult } from '@/components/v4';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import { api } from '@/lib/api';
import { CREDIT_PACKAGES } from '@/lib/catalog';
import { SlipCheckState } from '@/types/v4';
import { Info, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface TopupQrData {
  pack_id: string;
  credits: number;
  amount: number;
  recipient_label: string;
  qr_data_url: string;
  payload: string;
}

export default function SellerTopUpPayPage() {
  const router = useRouter();
  const { idToken } = useLiff();
  const { selectedPackageId, submitTopUpSlip } = useSeller();

  const pkg =
    CREDIT_PACKAGES.find((p) => p.id === selectedPackageId) ||
    CREDIT_PACKAGES[1];

  const [qrData, setQrData] = useState<TopupQrData | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [slipUrl, setSlipUrl] = useState('');
  const [slipState, setSlipState] = useState<SlipCheckState>('NONE');
  const [slipError, setSlipError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadQr = useCallback(async () => {
    if (!idToken) {
      setQrLoading(false);
      return;
    }
    setQrLoading(true);
    setQrError(null);
    try {
      const data = await api.get<TopupQrData>(
        `/api/users/me/topup-qr?pack_id=${encodeURIComponent(pkg.id)}`,
        { token: idToken }
      );
      setQrData(data);
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'ไม่สามารถสร้างคิวอาร์พร้อมเพย์ได้');
    } finally {
      setQrLoading(false);
    }
  }, [idToken, pkg.id]);

  useEffect(() => {
    void loadQr();
  }, [loadQr]);

  const isChecking = slipState === 'CHECKING';

  const handleSubmit = async () => {
    if (!slipUrl) {
      setToastMessage('กรุณาแนบสลิปการโอนเงินก่อนส่ง');
      return;
    }
    setSlipState('CHECKING');
    setSlipError(null);
    setToastMessage('กำลังตรวจสลิป · ไม่ต้องปิดหน้านี้');
    try {
      const receipt = await submitTopUpSlip({
        packId: pkg.id,
        credits: pkg.credits,
        price: pkg.price,
        slipImageUrl: slipUrl,
      });
      setSlipState('PASSED');
      setToastMessage(`ตรวจสลิปผ่าน · เติม ${receipt.credits} เครดิตแล้ว`);
      setTimeout(() => router.push('/seller/credits/success'), 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'สลิปไม่ผ่านการตรวจสอบ ลองแนบใหม่';
      setSlipState('FAILED');
      setSlipError(msg);
      setToastMessage(msg);
    }
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

        {qrError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {qrError}
            </span>
            <button
              type="button"
              onClick={() => void loadQr()}
              className="font-bold underline shrink-0"
            >
              ลองใหม่
            </button>
          </div>
        )}

        <QrPayCard
          amount={qrData?.amount ?? pkg.price}
          recipientLabel={qrData?.recipient_label || 'กองดอง · บัญชีรับชำระ'}
          reference={`TOPUP-${pkg.id.toUpperCase()}`}
          qrDataUrl={qrData?.qr_data_url}
          state={qrLoading || isChecking ? 'loading' : 'ready'}
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
                  setSlipError(null);
                }}
                onRemove={() => {
                  setSlipUrl('');
                  setSlipError(null);
                }}
                amountLabel={`฿${pkg.price}`}
                error={
                  slipState === 'FAILED'
                    ? slipError || 'สลิปไม่ผ่านการตรวจ ลองแนบใหม่'
                    : undefined
                }
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
            แนบสลิปแล้วกดยืนยัน · ระบบจะตรวจสอบสลิปและเติมเครดิตเข้าบัญชีให้ทันที
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
            onClick={() => void handleSubmit()}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            ส่งสลิปและเติมเครดิต
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
