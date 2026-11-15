'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import { EmptyState } from '@/components/ui';
import { api } from '@/lib/api';
import { useLiff } from '@/hooks/useLiff';
import {
  AppNotificationItem,
  BackendNotification,
  mapBackendNotificationToItem,
} from '@/lib/mappers';
import { Package, Bell, Sparkles, Store, ShoppingBag, Coins } from 'lucide-react';

export default function NotificationsPage() {
  const { isReady, isLoggedIn, idToken } = useLiff();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'BUYER' | 'SELLER'>('BUYER');

  const loadNotifications = useCallback(
    async (role: 'BUYER' | 'SELLER') => {
      if (!isReady) return;
      if (!isLoggedIn || !idToken) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ items: BackendNotification[]; unreadCount: number }>(
          `/api/notifications?role=${role}&limit=50`,
          { token: idToken }
        );
        setNotifications((res.items ?? []).map(mapBackendNotificationToItem));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดการแจ้งเตือนไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    },
    [isReady, isLoggedIn, idToken]
  );

  useEffect(() => {
    loadNotifications(view);
  }, [view, loadNotifications]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await api.patch(`/api/notifications/read-all?role=${view}`, { token: idToken });
    } catch {
      // Keep UI responsive
    }
  };

  const handleMarkOneRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    try {
      await api.patch(`/api/notifications/${id}/read`, { token: idToken });
    } catch {
      // Ignore transient error during navigation
    }
  };

  const getIcon = (type: AppNotificationItem['type']) => {
    switch (type) {
      case 'order':
        return <Package className="w-5 h-5 text-emerald-600" />;
      case 'wishlist':
        return <Sparkles className="w-5 h-5 text-amber-600" />;
      case 'credit':
        return <Coins className="w-5 h-5 text-amber-500" />;
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
        {loading ? (
          <div className="space-y-2.5">
            <div className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-20 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              title="โหลดการแจ้งเตือนไม่สำเร็จ"
              description={error}
              actionText="ลองใหม่"
              onAction={() => loadNotifications(view)}
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-1.5">
            {view === 'SELLER' ? (
              <Store className="w-7 h-7 text-slate-300 mx-auto" />
            ) : (
              <Bell className="w-7 h-7 text-slate-300 mx-auto" />
            )}
            <p className="text-sm font-bold text-slate-700">ยังไม่มีการแจ้งเตือน</p>
            <p className="text-[11px] text-slate-500">
              {view === 'SELLER'
                ? 'เมื่อมีผู้ขอซื้อหนังสือหรืออัปเดตออเดอร์จะแจ้งที่นี่'
                : 'ความเคลื่อนไหวของคำสั่งซื้อจะแสดงที่นี่'}
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id}
              href={n.linkUrl}
              onClick={() => handleMarkOneRead(n.id)}
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
          ))
        )}
      </div>
    </div>
  );
}

