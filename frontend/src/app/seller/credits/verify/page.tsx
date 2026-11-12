'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import {
  ShieldCheck,
  CreditCard,
  Landmark,
  AlertCircle,
  Check,
} from 'lucide-react';

const BANKS = [
  'ธนาคารกสิกรไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารออมสิน',
];

export default function PayoutVerifyPage() {
  const router = useRouter();
  const { shop, verifyPayee } = useSeller();

  const [promptPayName, setPromptPayName] = useState('');
  const [bankName, setBankName] = useState(BANKS[0]);
  const [bankAccount, setBankAccount] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!promptPayName.trim() || !bankAccount.trim()) {
      setError('กรอกชื่อบัญชีและเลขบัญชีให้ครบ');
      return;
    }
    if (!accepted) {
      setError('กรุณายืนยันว่าข้อมูลบัญชีเป็นของคุณ');
      return;
    }
    setError(null);
    verifyPayee();
    setToastMessage('ยืนยันบัญชีรับเงินแล้ว');
    setTimeout(() => router.push('/seller/credits'), 700);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ยืนยันบัญชีรับเงิน" onBack={() => router.push('/seller/credits')} />

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-[var(--color-primary-dark)]" />
          </span>
          <div>
            <h1 className="text-sm font-bold text-slate-900">
              ใช้ครั้งแรกตอนเติมเครดิต
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
              ข้อมูลนี้เห็นเฉพาะแอดมินเพื่อตรวจสลิปและโอนเงินคืนกรณีมีปัญหา ·
              ผู้ซื้อไม่มีทางเห็นชื่อจริงหรือเลขบัญชี
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <Input
            label="ชื่อบัญชีพร้อมเพย์ *"
            placeholder="ชื่อ-นามสกุลตามบัญชีธนาคาร"
            leftIcon={<CreditCard className="w-4 h-4" />}
            value={promptPayName}
            onChange={(event) => {
              setPromptPayName(event.target.value);
              setError(null);
            }}
            helperText="ต้องตรงกับบัญชีที่ใช้รับเงินจริง"
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="payout-bank" className="text-xs font-semibold text-slate-700">
              ธนาคาร
            </label>
            <div className="relative">
              <Landmark className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                id="payout-bank"
                value={bankName}
                onChange={(event) => setBankName(event.target.value)}
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              >
                {BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="เลขบัญชี *"
            placeholder="xxx-x-xx123-4"
            inputMode="numeric"
            value={bankAccount}
            onChange={(event) => {
              setBankAccount(event.target.value);
              setError(null);
            }}
            helperText="แสดงบางส่วนในหน้าตรวจสลิปของแอดมินเท่านั้น"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setAccepted((prev) => !prev);
            setError(null);
          }}
          className="w-full flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 text-left"
        >
          <span
            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
              accepted
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                : 'bg-white border-slate-300'
            }`}
          >
            {accepted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </span>
          <span className="text-xs text-slate-600 leading-relaxed">
            ฉันยืนยันว่าบัญชีนี้เป็นของฉัน และยอมให้แอดมินใช้ตรวจสลิปเท่านั้น
            · ไม่แสดงให้ผู้ซื้อเห็น
          </span>
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          {shop?.shopName
            ? `ร้าน ${shop.shopName} ยังไม่ยืนยันบัญชี · `
            : ''}
          ร้านที่ยังไม่ยืนยันรับได้เฉพาะนัดรับและจ่ายเงินสด
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" onClick={handleSubmit}>
            ยืนยันบัญชีรับเงิน
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
