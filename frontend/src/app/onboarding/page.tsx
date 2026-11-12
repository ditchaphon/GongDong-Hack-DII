'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { BookOpen, ShieldCheck, MapPin, Gift, ChevronRight } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();

  // v4: both paths start with nickname + avatar + PDPA consent.
  const handleStartBuying = () => {
    router.push('/setup?next=buy');
  };

  const handleStartSelling = () => {
    router.push('/setup?next=sell');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white px-6 py-8 justify-between select-none animate-fade-in">
      <div className="space-y-6 pt-4">
        {/* Brand header */}
        <div className="space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-[#06C755] text-white flex items-center justify-center font-black text-2xl shadow-sm mb-4">
            ก
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            กองดอง
          </h1>
          <p className="text-sm font-medium text-slate-500">
            ตลาดหนังสือมือสองบน LINE
          </p>
        </div>

        {/* 3 Core Value Props */}
        <div className="space-y-3 pt-2">
          {/* Item 1 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shrink-0">
              1
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">ลงขายฟรี</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                สแกน ISBN ลงขายได้ในไม่กี่นาที ตรวจสอบสภาพตามจริง
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-sm shrink-0">
              2
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">ซื้ออย่างมั่นใจ</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                รูปจริง 4 ด้าน + ป้ายชื่อร้าน · เกรดสภาพจากเช็ก 5 จุด
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm shrink-0">
              3
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">นัดรับ ฿0</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                ปักหมุดจุดนัดเองได้ ดูของจริงก่อนจ่าย หรือเลือกส่งพัสดุ
              </p>
            </div>
          </div>
        </div>

        {/* Free Credit Bonus Banner */}
        <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-emerald-100/70 border border-emerald-200 rounded-2xl flex items-center gap-3">
          <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-2xs shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-emerald-900">
              🎁 คุณได้รับ 1 เครดิตฟรี
            </div>
            <div className="text-emerald-700">
              สำหรับกดรับออเดอร์เมื่อเริ่มเปิดร้านขาย
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-6 pb-2 safe-area-bottom">
        <Button fullWidth size="lg" onClick={handleStartBuying}>
          เริ่มเลือกซื้อหนังสือ
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={handleStartSelling}
        >
          ฉันอยากขายหนังสือ
        </Button>
      </div>
    </div>
  );
}

