'use client';

import React from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Bell, Package, Store } from 'lucide-react';

export interface BottomTabProps {
  orderBadge?: number;
  className?: string;
}

export const BottomTab: React.FC<BottomTabProps> = ({
  orderBadge,
  className,
}) => {
  const pathname = usePathname();

  const tabs = [
    {
      id: 'home',
      label: 'หน้าแรก',
      href: '/',
      icon: Home,
      exact: true,
    },
    {
      id: 'wishlist',
      label: 'ฝากตามหา',
      href: '/wishlist',
      icon: Bell,
    },
    {
      id: 'orders',
      label: 'ออเดอร์',
      href: '/orders',
      icon: Package,
      badge: orderBadge,
    },
    {
      id: 'shop',
      label: 'ร้านของฉัน',
      href: '/seller',
      icon: Store,
    },
  ];

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none',
        className
      )}
    >
      <div className="w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-slate-200 pointer-events-auto safe-area-bottom">
        <div className="flex items-center justify-around h-14 px-2">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={clsx(
                  'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors select-none active:scale-95',
                  isActive ? 'text-[#06C755] font-semibold' : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <div className="relative">
                  <Icon className={clsx('w-5 h-5 transition-transform', isActive && 'scale-110')} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

