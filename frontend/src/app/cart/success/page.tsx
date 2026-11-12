'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { CheckCircle2, Clock, MapPin, ArrowRight } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function CartSuccessPage() {
  const router = useRouter();
  const { sellerName, deliveryMethod, grandTotal } = useCart();

  return (
    <div className="flex flex-col min-h-screen bg-white select-none justify-between p-6">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 pt-12">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-[#06C755] flex items-center justify-center animate-scale-up">
          <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
        </div>

        <div className="space-y-1">
          <span className="text-xs font-mono font-semibold text-slate-400">
            ออเดอร์ #ORD-12345
          </span>
          <h1 className="text-2xl font-black text-slate-900">
            ส่งคำขอซื้อเรียบร้อยแล้ว!
          </h1>
        </div>

        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          ระบบได้ส่งแจ้งเตือนไปยัง <span className="font-bold text-slate-800">ร้าน{sellerName || 'ผู้ขาย'}</span> แล้ว เมื่อผู้ขายกดรับออเดอร์ ระบบจะเปิดเผยเบอร์โทรศัพท์และจุดนัดพบให้คุณทันที
        </p>

        {/* Order Info Card */}
        <div className="w-full max-w-xs p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-2 mt-4">
          <div className="flex justify-between text-slate-500">
            <span>วิธีรับ:</span>
            <span className="font-bold text-slate-800">
              {deliveryMethod === 'MEETUP' ? '🤝 นัดรับใน มช. (฿0)' : '📦 ส่งพัสดุ'}
            </span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>ยอดชำระ:</span>
            <span className="font-bold text-[#06C755]">
              ฿{grandTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-100">
            <span>สถานะ:</span>
            <span className="font-bold text-amber-600">รอผู้ขายกดยืนยัน</span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 pt-6 pb-2 safe-area-bottom">
        <Button
          fullWidth
          size="lg"
          onClick={() => router.push('/orders/ORD-12345')}
        >
          ดูสถานะออเดอร์
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="outline"
          onClick={() => router.push('/')}
        >
          กลับสู่หน้าหลัก
        </Button>
      </div>
    </div>
  );
}

