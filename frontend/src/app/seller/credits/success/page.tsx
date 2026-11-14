'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { TopUpReceipt, useSeller } from '@/hooks/useSeller';
import { CREDIT_PACKAGES } from '@/lib/catalog';
import {
  CheckCircle2,
  CreditCard,
  History,
  Store,
  Info,
} from 'lucide-react';

export default function SellerTopUpSuccessPage() {
  const router = useRouter();
  const { credits, lastTopUpReceipt } = useSeller();
  const [storedReceipt, setStoredReceipt] = useState<TopUpReceipt | null>(null);

  useEffect(() => {
    if (lastTopUpReceipt) return;
    try {
      const raw = window.sessionStorage.getItem('gongdong.last_topup_receipt');
      if (raw) {
        setStoredReceipt(JSON.parse(raw) as TopUpReceipt);
      }
    } catch {
      // Ignore storage errors
    }
  }, [lastTopUpReceipt]);

  const receipt = lastTopUpReceipt || storedReceipt;
  const pkg = CREDIT_PACKAGES.find((p) => p.id === receipt?.packId);
  const displayCredits = credits > 0 ? credits : receipt?.totalCredits ?? credits;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-7 text-center space-y-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="w-8 h-8 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">เติมเครดิตสำเร็จ</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          {receipt
            ? `เพิ่ม ${receipt.credits} เครดิตจากแพ็กเกจ ${pkg?.name ?? receipt.packId} เข้าบัญชีแล้ว`
            : 'ยอดเครดิตล่าสุดของคุณพร้อมใช้งานสำหรับรับออเดอร์แล้ว'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-50">
            <CreditCard className="w-4 h-4" />
            เครดิตคงเหลือในขณะนี้
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black">{displayCredits}</span>
            <span className="text-sm text-emerald-50">เครดิต</span>
          </div>
          <p className="text-[11px] text-emerald-50/90 pt-1">
            รับออเดอร์ได้อีก {displayCredits} ครั้ง
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>แพ็กเกจ</span>
            <span className="font-semibold text-slate-800">
              {receipt
                ? `${pkg?.name ?? receipt.packId} · ${receipt.credits} เครดิต`
                : '-'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ยอดชำระ</span>
            <span className="font-semibold text-slate-800">
              {receipt ? `฿${receipt.price}` : '-'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>วิธีชำระ</span>
            <span className="font-semibold text-slate-800">พร้อมเพย์ + สลิป</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500">สถานะ</span>
            <span className="font-bold text-emerald-700">
              ตรวจสอบแล้ว · เติมเข้าบัญชีแล้ว ✓
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            เครดิตถูกหัก 1 เครดิตเฉพาะตอนกดรับออเดอร์เท่านั้น · หากปฏิเสธหรือออเดอร์ถูกยกเลิกก่อนส่ง เครดิตจะถูกคืนให้อัตโนมัติ
          </span>
        </div>

        <Button
          variant="outline"
          fullWidth
          leftIcon={<History className="w-4 h-4" />}
          onClick={() => router.push('/seller/credits')}
        >
          ดูประวัติเครดิต
        </Button>

        <Button
          fullWidth
          leftIcon={<Store className="w-4 h-4" />}
          onClick={() => router.push('/seller')}
        >
          กลับไปที่ร้าน
        </Button>
      </div>
    </div>
  );
}
