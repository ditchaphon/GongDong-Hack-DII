'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { EmptyState } from '@/components/ui';
import { StatusBadgeV4, LineOaBanner } from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { useAppMode } from '@/hooks/useAppMode';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import { getNextAction, getTimerInfo, isTerminal } from '@/lib/orderStateMachine';
import { V4Order, ViewRole } from '@/types/v4';
import { Package, Clock, ChevronRight, ShoppingBag, Store, FlaskConical, Trash2 } from 'lucide-react';

type Tab = 'BUYING' | 'SELLING';

function OrderRow({
  order,
  role,
  isDryRun,
  onOpen,
}: {
  order: V4Order;
  role: ViewRole;
  isDryRun?: boolean;
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
      className={`w-full text-left bg-white rounded-2xl border p-3.5 space-y-2.5 transition ${
        isDryRun
          ? 'border-amber-300 bg-amber-50/20 hover:border-amber-400'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-medium text-slate-400 truncate">#{order.id}</span>
          {isDryRun && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0">
              <FlaskConical className="w-2.5 h-2.5" />
              Dry-Run
            </span>
          )}
        </div>
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
            {role === 'BUYER' ? order.shop.shopName : `ผู้ซื้อ #${order.id.slice(-4)}`} ·{' '}
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
  const { user, isReady } = useLiff();
  const {
    orders,
    loading,
    hasResolved,
    error,
    refreshOrders,
    isMineAsBuyer,
    isDryRunOrder,
    clearDryRunOrders,
  } = useV4Orders();
  const { mode, setMode } = useAppMode();
  const { isShopSetup, loading: sellerLoading } = useSeller();
  const [explicitTab, setExplicitTab] = useState<Tab | null>(null);
  const dryRunCount = user.isAdmin ? orders.filter((o) => isDryRunOrder(o.id)).length : 0;

  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('tab')?.toLowerCase();
      if (param === 'buying') setExplicitTab('BUYING');
      else if (param === 'selling') setExplicitTab('SELLING');
    } catch {
      /* ignore */
    }
  }, []);

  const tab: Tab = explicitTab ?? (mode === 'SELLER' ? 'SELLING' : 'BUYING');

  const buying = orders.filter(isMineAsBuyer);
  const selling = orders.filter((order) => !isMineAsBuyer(order));

  const handleSelectTab = (next: Tab) => {
    setExplicitTab(next);
    if (next === 'BUYING') {
      if (mode !== 'BUYER') setMode('BUYER');
    } else if ((isShopSetup || selling.length > 0) && mode !== 'SELLER') {
      setMode('SELLER');
    }
  };

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

  const isInitialLoading =
    !isReady ||
    !hasResolved ||
    (loading && orders.length === 0) ||
    (sellerLoading && orders.length === 0 && !isShopSetup);

  if (isInitialLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-20 cursor-wait">
        <TopBar
          title={tab === 'BUYING' ? 'ออเดอร์ที่ซื้อ' : 'ออเดอร์ร้าน'}
          subtitle="กำลังโหลด..."
          showBack={false}
        />

        <div className="p-4 space-y-3 flex-1 pointer-events-none" aria-busy="true">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-200/70 animate-pulse">
            <div className="h-9 rounded-xl bg-white/80" />
            <div className="h-9 rounded-xl bg-slate-200/60" />
          </div>
          <div className="h-14 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
        </div>

        <BottomTab
          disabled
          forceMode={tab === 'SELLING' ? 'SELLER' : 'BUYER'}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-20">
      <TopBar
        title={tab === 'BUYING' ? 'ออเดอร์ที่ซื้อ' : 'ออเดอร์ร้าน'}
        subtitle={tab === 'BUYING' ? `${buying.length} รายการ` : `${selling.length} รายการ`}
        showBack={false}
      />

      <div className="p-4 space-y-3 flex-1">
        <div
          role="tablist"
          aria-label="ประเภทคำสั่งซื้อ"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-slate-200/70"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'BUYING'}
            onClick={() => handleSelectTab('BUYING')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              tab === 'BUYING'
                ? 'bg-white text-[#8B5E3C] shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>ออเดอร์ที่ซื้อ</span>
            {needsBuyer > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {needsBuyer}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'SELLING'}
            onClick={() => handleSelectTab('SELLING')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              tab === 'SELLING'
                ? 'bg-white text-teal-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>ออเดอร์ร้าน</span>
            {needsSeller > 0 && (
              <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {needsSeller}
              </span>
            )}
          </button>
        </div>

        <LineOaBanner />
        {dryRunCount > 0 && (
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <FlaskConical className="w-3.5 h-3.5 text-amber-700" />
              มีออเดอร์ Dry-Run อยู่ {dryRunCount} รายการ
            </span>
            <button
              type="button"
              onClick={clearDryRunOrders}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-amber-300 text-[10px] font-bold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="w-3 h-3" />
              ล้าง Dry-Run
            </button>
          </div>
        )}
        {loading && orders.length === 0 ? (
          <div className="space-y-3">
            <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        ) : error && orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 mt-2">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-400" />}
              title="โหลดรายการออเดอร์ไม่สำเร็จ"
              description={error}
              actionText="ลองใหม่"
              onAction={() => refreshOrders()}
            />
          </div>
        ) : sorted.length === 0 ? (
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
              isDryRun={isDryRunOrder(order.id)}
              onOpen={() =>
                router.push(
                  `/orders/${order.id}${role === 'SELLER' ? '?role=seller' : ''}`
                )
              }
            />
          ))
        )}
      </div>

      <BottomTab
        forceMode={tab === 'SELLING' ? 'SELLER' : 'BUYER'}
        orderBadge={tab === 'BUYING' ? needsBuyer : needsSeller}
      />
    </div>
  );
}
