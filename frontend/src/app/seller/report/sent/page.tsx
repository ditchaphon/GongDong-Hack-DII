'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Store,
  ShieldCheck,
} from 'lucide-react';

export default function SellerReportSentPage() {
  const router = useRouter();

  const caseNumber = `RP-${new Date().getFullYear()}-0148`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-28">
      <div className="bg-white border-b border-slate-100 px-4 pt-12 pb-7 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#8B5E3C]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">ส่งรายงานแล้ว</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          แอดมินได้รับเรื่องแล้ว จะตรวจสอบและแจ้งผลให้คุณทางแชท LINE
        </p>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
          หมายเลขเคส: {caseNumber}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            สิ่งที่จะเกิดขึ้นต่อไป
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">รอแอดมินตรวจสอบ</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ภายใน 24 ชั่วโมง ในเวลาทำการ
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">แอดมินอาจติดต่อขอข้อมูลเพิ่ม</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ทางแชท LINE Official Account ของกองดอง
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="font-bold text-slate-800">แจ้งผลและดำเนินการ</div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  อาจมีการเตือน ระงับบัญชี หรือคืนเครดิตตามผลการตรวจสอบ
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
          ระหว่างรอผล คุณยังขายหนังสือเล่มอื่นได้ตามปกติ
          แต่ไม่ควรปิดการขายออเดอร์ที่กำลังมีข้อพิพาท
        </div>

        <div className="space-y-2">
          <Button
            fullWidth
            size="lg"
            onClick={() => router.push('/orders')}
          >
            กลับไปที่ออเดอร์ของฉัน
          </Button>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<Store className="w-4 h-4" />}
            onClick={() => router.push('/seller')}
          >
            ไปที่ร้านของฉัน
          </Button>
        </div>
      </div>
    </div>
  );
}
