'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { MOCK_CREDIT_PACKAGES } from '@/mocks/seller';
import {
  CheckCircle2,
  CreditCard,
  Store,
  Package,
  Info,
} from 'lucide-react';

export default function SellerTopUpSuccessPage() {
  const router = useRouter();
  const { credits, selectedPackageId } = useSeller();

  const pkg =
    MOCK_CREDIT_PACKAGES.find((p) => p.id === selectedPackageId) ||
    MOCK_CREDIT_PACKAGES[1];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-7 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#06C755]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">เติมเครดิตสำเร็จ! (S5OK)</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          เพิ่ม {pkg.credits} เครดิตจากแพ็กเกจ {pkg.name} · ฿{pkg.price}
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
            รับออเดอร์ได้อีก {credits} ครั้ง
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>แพ็กเกจ</span>
            <span className="font-semibold text-slate-800">
              {pkg.name} · {pkg.credits} เครดิต
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ยอดชำระ</span>
            <span className="font-semibold text-slate-800">฿{pkg.price}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>วิธีชำระ</span>
            <span className="font-semibold text-slate-800">พร้อมเพย์ + สลิป</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500">สถานะ</span>
            <span className="font-bold text-emerald-700">เติมเข้าบัญชีแล้ว ✓</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            โหมดจำลอง: ระบบเติมเครดิตอัตโนมัติ · ในการใช้งานจริง แอดมินจะตรวจสลิปและเติมเครดิตให้ภายใน 30 นาที
          </span>
        </div>

        <div className="space-y-2">
          <Button
            fullWidth
            size="lg"
            leftIcon={<Package className="w-4 h-4" />}
            onClick={() => router.push('/seller/orders')}
          >
            ไปรับออเดอร์ที่รออยู่
          </Button>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<Store className="w-4 h-4" />}
            onClick={() => router.push('/seller')}
          >
            กลับไปที่ร้านของฉัน
          </Button>
        </div>
      </div>
    </div>
  );
}
