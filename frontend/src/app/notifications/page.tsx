'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { MOCK_NOTIFICATIONS, NotificationItem } from '@/mocks/books';
import { Package, Bell, Sparkles, ChevronRight, Check } from 'lucide-react';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);

  const markAllAsRead = () => {
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
        title="ศูนย์แจ้งเตือน (B6)"
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

      <div className="p-4 space-y-2.5 flex-1">
        {notifications.map((n) => (
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

