'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { CREDIT_PACKAGES } from '@/lib/catalog';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  Store,
  Info,
} from 'lucide-react';

export default function SellerTopUpSuccessPage() {
  const router = useRouter();
  const { credits, pendingTopUp, approveTopUp } = useSeller();

  const [justApproved, setJustApproved] = useState(false);

  const pkg = CREDIT_PACKAGES.find((p) => p.id === pendingTopUp?.packId);

  const approved = justApproved && !pendingTopUp;

  const handleApprove = () => {
    approveTopUp();
    setJustApproved(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-7 text-center space-y-3">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${
            approved
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          {approved ? (
            <CheckCircle2 className="w-8 h-8 text-[var(--color-primary)]" />
          ) : (
            <Clock3 className="w-8 h-8 text-amber-600" />
          )}
        </div>
        <h1 className="text-xl font-black text-slate-900">
          {approved ? 'เติมเครดิตสำเร็จ' : 'ส่งสลิปแล้ว · รอแอดมินตรวจ'}
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          {approved
            ? `เพิ่ม ${pkg?.credits ?? 0} เครดิตจากแพ็กเกจ ${pkg?.name ?? ''} แล้ว`
            : 'ปกติใช้เวลาตรวจไม่เกิน 30 นาทีในเวลาทำการ · เครดิตจะเข้าบัญชีหลังอนุมัติ'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-50">
            <CreditCard className="w-4 h-4" />
            เครดิตคงเหลือในขณะนี้
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black">{credits}</span>
            <span className="text-sm text-emerald-50">เครดิต</span>
          </div>
          <p className="text-[11px] text-emerald-50/90 pt-1">
            {approved
              ? `รับออเดอร์ได้อีก ${credits} ครั้ง`
              : 'ยอดจะเพิ่มหลังแอดมินอนุมัติสลิป'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>แพ็กเกจ</span>
            <span className="font-semibold text-slate-800">
              {pkg ? `${pkg.name} · ${pkg.credits} เครดิต` : '-'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ยอดชำระ</span>
            <span className="font-semibold text-slate-800">
              {pkg ? `฿${pkg.price}` : '-'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>วิธีชำระ</span>
            <span className="font-semibold text-slate-800">คิวอาร์ + สลิป</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500">สถานะ</span>
            <span className={`font-bold ${approved ? 'text-emerald-700' : 'text-amber-700'}`}>
              {approved ? 'อนุมัติแล้ว · เติมเข้าบัญชี ✓' : 'รอแอดมินตรวจสลิป'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            ระบบจะแจ้งเตือนใน LINE เมื่อสลิปผ่านหรือไม่ผ่าน ·
            ถ้าสลิปไม่ผ่าน เครดิตจะไม่ถูกเติมและแนบใหม่ได้ทันที
          </span>
        </div>

        {!approved && pendingTopUp && (
          <Button variant="outline" fullWidth onClick={handleApprove}>
            อัปเดตสถานะ (จำลองการอนุมัติ)
          </Button>
        )}

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
