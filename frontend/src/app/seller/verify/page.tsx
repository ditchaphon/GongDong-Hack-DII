'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Input, Toast } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import {
  ShieldCheck,
  Phone,
  CreditCard,
  Check,
  AlertCircle,
  Landmark,
} from 'lucide-react';

export default function SellerVerifyPage() {
  const router = useRouter();
  const { isVerified, verifySeller } = useSeller();

  const [fullName, setFullName] = useState('สกาย ระมัดระวัง');
  const [phone, setPhone] = useState('081-234-5678');
  const [promptPayName, setPromptPayName] = useState('นาย สกาย ระมัดระวัง');
  const [bankName, setBankName] = useState('ธนาคารกสิกรไทย');
  const [bankAccount, setBankAccount] = useState('xxx-x-xx123-4');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const banks = [
    'ธนาคารกสิกรไทย',
    'ธนาคารไทยพาณิชย์',
    'ธนาคารกรุงเทพ',
    'ธนาคารกรุงไทย',
    'ธนาคารออมสิน',
  ];

  const handleSubmit = () => {
    if (!fullName.trim() || !phone.trim() || !promptPayName.trim() || !bankAccount.trim()) {
      setError('กรอกข้อมูลให้ครบทุกช่องก่อนยืนยันตัวตน');
      return;
    }
    if (!accepted) {
      setError('กรุณายอมรับกติกาการซื้อขายก่อนยืนยันตัวตน');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    setTimeout(() => {
      verifySeller({ phone, promptPayName, bankName, bankAccount });
      setIsSubmitting(false);
      setToastMessage('ยืนยันตัวตนสำเร็จ ✓ ได้รับเครดิตฟรี 1 เครดิต');
      setTimeout(() => router.push('/seller/list'), 900);
    }, 700);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ยืนยันตัวตนผู้ขาย" onBack={() => router.push('/seller')} />

      <div className="p-4 space-y-4">
        {/* Trust intro */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            ยืนยันตัวตนครั้งเดียว ใช้ขายได้ตลอด
          </div>
          <p className="text-xs text-emerald-800 leading-relaxed">
            กองดองไม่มีระบบพักเงิน เราใช้การยืนยันตัวตนและรูปถ่ายจริงเพื่อสร้างความมั่นใจให้ผู้ซื้อ
            ชื่อบัญชีพร้อมเพย์ต้องตรงกับชื่อที่ใช้ยืนยันตัวตน
          </p>
        </div>

        {isVerified && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-emerald-200 text-xs text-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 stroke-[3]" />
            <span>คุณยืนยันตัวตนแล้ว สามารถกลับไปลงขายหนังสือได้เลย</span>
          </div>
        )}

        {/* Identity form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ข้อมูลผู้ขาย
          </h3>

          <Input
            label="ชื่อ-นามสกุลจริง"
            placeholder="เช่น สกาย ระมัดระวัง"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <Input
            label="เบอร์โทรศัพท์"
            type="tel"
            inputMode="tel"
            placeholder="08X-XXX-XXXX"
            leftIcon={<Phone className="w-4 h-4" />}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            helperText="เบอร์นี้จะแสดงให้ผู้ซื้อเห็นหลังคุณรับออเดอร์เท่านั้น"
          />
        </div>

        {/* PromptPay */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            บัญชีรับเงิน (พร้อมเพย์)
          </h3>

          <Input
            label="ชื่อบัญชีพร้อมเพย์"
            placeholder="ชื่อ-นามสกุล ตามบัญชีธนาคาร"
            leftIcon={<CreditCard className="w-4 h-4" />}
            value={promptPayName}
            onChange={(e) => setPromptPayName(e.target.value)}
            helperText="ต้องตรงกับชื่อ-นามสกุลจริงด้านบนเท่านั้น"
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="bank-name"
              className="text-xs font-semibold text-slate-700"
            >
              ธนาคาร
            </label>
            <div className="relative">
              <Landmark className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-white rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:border-[#06C755] focus:ring-2 focus:ring-[#06C755]/20"
              >
                {banks.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="เลขบัญชี (แสดงบางส่วนได้)"
            placeholder="xxx-x-xx123-4"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
          />
        </div>

        {/* Rules */}
        <button
          type="button"
          onClick={() => {
            setAccepted((prev) => !prev);
            setError(null);
          }}
          className="w-full flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-200 text-left active:scale-[0.99] transition"
        >
          <span
            className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
              accepted
                ? 'bg-[#06C755] border-[#06C755] text-white'
                : 'bg-white border-slate-300'
            }`}
          >
            {accepted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </span>
          <span className="text-xs text-slate-600 leading-relaxed">
            ข้าพเจ้ายอมรับกติกา: ลงขายฟรี · ใช้ 1 เครดิตเมื่อกดรับออเดอร์ ·
            ห้ามลงรูปปลอมหรือปกปิดตำหนิ · ต้องส่งหนังสือภายใน 48 ชั่วโมงหลังได้รับเงิน
          </span>
        </button>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed px-1">
          ระบบจะเก็บข้อมูลนี้ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น และไม่แสดงเลขบัญชีเต็มให้ผู้ซื้อเห็น
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" isLoading={isSubmitting} onClick={handleSubmit}>
            ยืนยันตัวตนและเริ่มขาย
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
