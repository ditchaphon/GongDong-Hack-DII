'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { MOCK_NOTIFICATIONS, NotificationItem } from '@/mocks/books';
import { useV4Orders } from '@/hooks/useV4Orders';
import { useSeller } from '@/hooks/useSeller';
import { Package, Bell, Sparkles, Store, ShoppingBag } from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [view, setView] = useState<'BUYER' | 'SELLER'>('BUYER');
  const { orders } = useV4Orders();
  const { shop } = useSeller();

  const sellerNotifications = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            !!shop &&
            order.shop.shopName === shop.shopName &&
            ['REQUESTED', 'ACCEPTED'].includes(order.status)
        )
        .map<NotificationItem>((order) => ({
          id: `seller-${order.id}`,
          type: 'order',
          title:
            order.status === 'REQUESTED'
              ? 'มีคำขอซื้อใหม่'
              : 'ผู้ซื้อยืนยันคำขอแล้ว',
          message: `${order.books[0]?.title ?? 'หนังสือ'} · ฿${order.total.toLocaleString()} · ${order.buyer.nickname}`,
          createdAt: new Date(order.createdAtISO).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
          }),
          linkUrl: `/orders/${order.id}`,
          isRead: false,
        })),
    [orders, shop]
  );

  const markAllAsRead = () => {
    if (view === 'SELLER') return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package className="w-5 h-5 text-emerald-600" />;
      case 'wishlist':
        return <Sparkles className="w-5 h-5 text-amber-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
      <TopBar
        title={view === 'SELLER' ? 'แจ้งเตือนผู้ขาย' : 'ศูนย์แจ้งเตือน'}
        rightAction={
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-xs text-slate-500 hover:text-slate-900 font-semibold px-2 py-1"
          >
            อ่านทั้งหมด
          </button>
        }
      />

      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setView('BUYER')}
            aria-pressed={view === 'BUYER'}
            className={`min-h-[38px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              view === 'BUYER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" /> ผู้ซื้อ
          </button>
          <button
            type="button"
            onClick={() => setView('SELLER')}
            aria-pressed={view === 'SELLER'}
            className={`min-h-[38px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 ${
              view === 'SELLER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <Store className="w-3.5 h-3.5" /> ผู้ขาย
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2.5 flex-1">
        {view === 'SELLER' && sellerNotifications.length === 0 && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-1.5">
            <Store className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">ยังไม่มีคำขอซื้อใหม่</p>
            <p className="text-[11px] text-slate-500">
              เมื่อมีผู้ขอซื้อหนังสือของ {shop?.shopName ?? 'ร้านคุณ'} จะแจ้งที่นี่
            </p>
          </div>
        )}
        {(view === 'SELLER' ? sellerNotifications : notifications).map((n) => (
          <Link
            key={n.id}
            href={n.linkUrl}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border transition ${
              n.isRead
                ? 'bg-white border-slate-200 text-slate-700'
                : 'bg-emerald-50/50 border-emerald-200 text-slate-900 shadow-2xs'
            }`}
          >
            <div className="p-2.5 bg-white rounded-xl shadow-2xs shrink-0">
              {getIcon(n.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm truncate">{n.title}</h4>
                <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                  {n.createdAt}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {n.message}
              </p>
            </div>

            {!n.isRead && (
              <span className="w-2 h-2 rounded-full bg-[#8B5E3C] shrink-0 mt-1.5" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

