'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { OrderCard, Chip, EmptyState } from '@/components/ui';
import { MOCK_ORDERS } from '@/mocks/books';
import { Package } from 'lucide-react';

export default function OrdersPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');

  const filteredOrders = MOCK_ORDERS.filter((o) => {
    if (filter === 'ACTIVE') return o.status !== 'COMPLETED' && o.status !== 'CANCELLED';
    if (filter === 'DONE') return o.status === 'COMPLETED' || o.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-20">
      <TopBar title="ออเดอร์ของฉัน" showBack={false} />

      {/* Tabs */}
      <div className="flex gap-2 p-4 bg-white border-b border-slate-100">
        <Chip
          label="ทั้งหมด"
          selected={filter === 'ALL'}
          count={MOCK_ORDERS.length}
          onClick={() => setFilter('ALL')}
          size="sm"
        />
        <Chip
          label="กำลังดำเนินการ"
          selected={filter === 'ACTIVE'}
          onClick={() => setFilter('ACTIVE')}
          size="sm"
        />
        <Chip
          label="สำเร็จแล้ว"
          selected={filter === 'DONE'}
          onClick={() => setFilter('DONE')}
          size="sm"
        />
      </div>

      {/* Order List */}
      <div className="p-4 space-y-3 flex-1">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              role="buyer"
              onClick={() => router.push(`/orders/${order.id}`)}
              onAction={() => router.push(`/orders/${order.id}`)}
            />
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-400" />}
              title="ไม่มีรายการออเดอร์ในหมวดนี้"
              description="เมื่อคุณสั่งซื้อหนังสือ สถานะออเดอร์ทั้งหมดจะแสดงที่นี่"
              actionText="ไปค้นหาหนังสือ"
              onAction={() => router.push('/')}
            />
          </div>
        )}
      </div>

      <BottomTab orderBadge={1} />
    </div>
  );
}

