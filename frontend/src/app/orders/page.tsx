'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { EmptyState } from '@/components/ui';
import { StatusBadgeV4 } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { getNextAction, getTimerInfo, isTerminal } from '@/lib/orderStateMachine';
import { V4Order, ViewRole } from '@/types/v4';
import { Package, Clock, ChevronRight, ShoppingBag, Store } from 'lucide-react';

type Tab = 'BUYING' | 'SELLING';

function OrderRow({
  order,
  role,
  onOpen,
}: {
  order: V4Order;
  role: ViewRole;
  onOpen: () => void;
}) {
  const action = getNextAction(order, role);
  const timer = getTimerInfo(order);
  const needsMe =
    (action.whoActs === 'BUYER' && role === 'BUYER') ||
    (action.whoActs === 'SELLER' && role === 'SELLER') ||
    (action.whoActs === 'BOTH');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 hover:border-slate-300 transition"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-medium text-slate-400">#{order.id}</span>
        <StatusBadgeV4 status={order.status} size="sm" />
      </div>

      <div className="flex gap-3">
        <img
          src={order.books[0]?.cover}
          alt={order.books[0]?.title ?? ''}
          className="w-12 h-16 rounded-lg object-cover bg-slate-100 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
            {order.books[0]?.title}
            {order.books.length > 1 ? ` +${order.books.length - 1}` : ''}
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {role === 'BUYER' ? order.shop.shopName : order.buyer.nickname} ·{' '}
            {order.delivery === 'MEETUP' ? 'นัดรับ' : 'ส่งพัสดุ'}
          </p>
          <p className="text-sm font-black text-slate-900 mt-1">
            ฿{order.total.toLocaleString()}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 self-center shrink-0" />
      </div>

      <div
        className={`flex items-center justify-between gap-2 p-2 rounded-xl text-[11px] ${
          needsMe
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
            : 'bg-slate-50 border border-slate-200 text-slate-500'
        }`}
      >
        <span className="font-semibold leading-snug">{action.title}</span>
        {timer && !isTerminal(order.status) && (
          <span className="inline-flex items-center gap-1 shrink-0 text-[10px]">
            <Clock className="w-3 h-3" />
            {timer.expired ? 'หมดเวลา' : `เหลือ ${timer.hoursLeft} ชม.`}
          </span>
        )}
      </div>
    </button>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { orders, isMineAsBuyer } = useV4Orders();
  const [tab, setTab] = useState<Tab>('BUYING');

  const buying = orders.filter(isMineAsBuyer);
  const selling = orders.filter((order) => !isMineAsBuyer(order));

  const needsBuyer = buying.filter((order) => {
    const action = getNextAction(order, 'BUYER');
    return !isTerminal(order.status) && (action.whoActs === 'BUYER' || action.whoActs === 'BOTH');
  }).length;
  const needsSeller = selling.filter((order) => {
    const action = getNextAction(order, 'SELLER');
    return !isTerminal(order.status) && (action.whoActs === 'SELLER' || action.whoActs === 'BOTH');
  }).length;

  const list = tab === 'BUYING' ? buying : selling;
  const role: ViewRole = tab === 'BUYING' ? 'BUYER' : 'SELLER';

  const sorted = [...list].sort(
    (a, b) =>
      new Date(b.updatedAtISO).getTime() - new Date(a.updatedAtISO).getTime()
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-20">
      <TopBar title="ออเดอร์" showBack={false} />

      <div className="grid grid-cols-2 gap-2 p-4 bg-white border-b border-slate-100">
        <button
          type="button"
          onClick={() => setTab('BUYING')}
          aria-pressed={tab === 'BUYING'}
          className={`relative flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition ${
            tab === 'BUYING'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          ที่ซื้อ ({buying.length})
          {needsBuyer > 0 && (
            <span className="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {needsBuyer}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('SELLING')}
          aria-pressed={tab === 'SELLING'}
          className={`relative flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition ${
            tab === 'SELLING'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-white border-slate-200 text-slate-500'
          }`}
        >
          <Store className="w-4 h-4" />
          ที่ขาย ({selling.length})
          {needsSeller > 0 && (
            <span className="absolute top-1.5 right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {needsSeller}
            </span>
          )}
        </button>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {sorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 mt-2">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-400" />}
              title={tab === 'BUYING' ? 'ยังไม่มีออเดอร์ที่ซื้อ' : 'ยังไม่มีออเดอร์ที่ขาย'}
              description={
                tab === 'BUYING'
                  ? 'ส่งคำขอซื้อจากหน้าหนังสือ แล้วติดตามสถานะได้ที่นี่'
                  : 'เมื่อมีคนขอซื้อหนังสือของคุณ คำขอจะแสดงที่นี่'
              }
              actionText={tab === 'BUYING' ? 'ไปค้นหาหนังสือ' : 'ไปที่ร้านของฉัน'}
              onAction={() =>
                router.push(tab === 'BUYING' ? '/' : '/seller')
              }
            />
          </div>
        ) : (
          sorted.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              role={role}
              onOpen={() =>
                router.push(
                  `/orders/${order.id}${role === 'SELLER' ? '?role=seller' : ''}`
                )
              }
            />
          ))
        )}
      </div>

      <BottomTab orderBadge={needsBuyer + needsSeller} />
    </div>
  );
}
