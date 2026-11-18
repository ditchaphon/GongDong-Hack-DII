'use client';

import React from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { FlaskConical, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { useLiff } from '@/hooks/useLiff';
import { useV4Orders } from '@/hooks/useV4Orders';
import type { V4Delivery, V4OrderStatus } from '@/types/v4';

interface AdminOrderDryRunBarProps {
  orderId: string;
  delivery?: V4Delivery;
  status?: V4OrderStatus;
  handoverCode?: string;
}

export const AdminOrderDryRunBar: React.FC<AdminOrderDryRunBarProps> = ({
  orderId,
  delivery,
  status,
  handoverCode,
}) => {
  const router = useRouter();
  const { user } = useLiff();
  const { isDryRunOrder, getDryRunRole, setDryRunRole, clearDryRunOrders } =
    useV4Orders();

  if (!user.isAdmin || !isDryRunOrder(orderId)) {
    return null;
  }

  const activeRole = getDryRunRole(orderId);

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2.5 text-amber-950">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <FlaskConical className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-snug">
            <p className="font-bold">Admin Order Dry-Run · จำลอง 2 ฝั่ง</p>
            <p className="text-amber-800/90 mt-0.5">
              ไม่บันทึกลง DB · ไม่หักเครดิตจริง · กดสลับบทบาทเพื่อทดสอบได้ครบทุกขั้น
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            clearDryRunOrders();
            router.push('/orders');
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-white text-[10px] font-bold text-rose-700 hover:bg-rose-50 shrink-0"
        >
          <Trash2 className="w-3 h-3" />
          ล้าง
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 bg-amber-100/80 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setDryRunRole(orderId, 'BUYER')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition',
            activeRole === 'BUYER'
              ? 'bg-white text-[#8B5E3C] shadow-xs'
              : 'text-amber-900/70 hover:text-amber-950'
          )}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          มุมมองผู้ซื้อ
        </button>
        <button
          type="button"
          onClick={() => setDryRunRole(orderId, 'SELLER')}
          className={clsx(
            'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition',
            activeRole === 'SELLER'
              ? 'bg-white text-teal-800 shadow-xs'
              : 'text-amber-900/70 hover:text-amber-950'
          )}
        >
          <Store className="w-3.5 h-3.5" />
          มุมมองผู้ขาย
        </button>
      </div>

      {delivery === 'MEETUP' && status === 'SCHEDULED' && handoverCode && (
        <p className="text-[10px] text-amber-900 bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1.5">
          รหัสส่งมอบ 6 หลักสำหรับทดสอบ: <strong className="font-mono tracking-wider">{handoverCode}</strong> (ดูจากมุมผู้ซื้อแล้วสลับมากรอกที่มุมผู้ขาย)
        </p>
      )}
    </div>
  );
};
