'use client';

import React from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, Store, PlusCircle, UserRound } from 'lucide-react';
import { useAppMode, type AppMode } from '@/hooks/useAppMode';

export interface BottomTabProps {
  orderBadge?: number;
  forceMode?: AppMode;
  disabled?: boolean;
  className?: string;
}

export const BottomTab: React.FC<BottomTabProps> = ({
  orderBadge,
  forceMode,
  disabled = false,
  className,
}) => {
  const pathname = usePathname();

  const { mode } = useAppMode();
  const isSeller = (forceMode ?? mode) === 'SELLER';

  type Tab = {
    id: string;
    label: string;
    href: string;
    icon: React.ElementType;
    exact?: boolean;
    badge?: number;
  };

  const buyerTabs: Tab[] = [
    { id: 'home', label: 'หน้าแรก', href: '/', icon: Home, exact: true },
    { id: 'orders', label: 'ออเดอร์', href: '/orders', icon: Package, badge: orderBadge },
    { id: 'profile', label: 'โปรไฟล์', href: '/profile', icon: UserRound },
  ];

  const sellerTabs: Tab[] = [
    { id: 'shop', label: 'ร้านของฉัน', href: '/seller', icon: Store, exact: true },
    { id: 'list', label: 'ลงขาย', href: '/seller/list', icon: PlusCircle },
    { id: 'orders', label: 'ออเดอร์ร้าน', href: '/orders', icon: Package, badge: orderBadge },
    { id: 'profile', label: 'โปรไฟล์', href: '/profile', icon: UserRound },
  ];

  const tabs = isSeller ? sellerTabs : buyerTabs;
  const activeColor = isSeller ? 'text-teal-700 font-semibold' : 'text-[#8B5E3C] font-semibold';

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none',
        className
      )}
    >
      <div
        aria-disabled={disabled || undefined}
        className={clsx(
          'w-full max-w-[430px] backdrop-blur-md border-t safe-area-bottom transition-opacity',
          disabled ? 'pointer-events-none opacity-60 cursor-wait' : 'pointer-events-auto',
          isSeller ? 'bg-teal-50/95 border-teal-200' : 'bg-white/95 border-slate-200'
        )}
      >
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
                aria-disabled={disabled || undefined}
                tabIndex={disabled ? -1 : undefined}
                onClick={disabled ? (e) => e.preventDefault() : undefined}
                className={clsx(
                  'relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors select-none',
                  !disabled && 'active:scale-95',
                  isActive ? activeColor : 'text-slate-400 hover:text-slate-600'
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

