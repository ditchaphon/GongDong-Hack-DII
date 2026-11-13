'use client';

import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { useAppMode, AppMode } from '@/hooks/useAppMode';
import { useLiff } from '@/hooks/useLiff';
import { useProfile } from '@/hooks/useProfile';
import { useSeller } from '@/hooks/useSeller';
import {
  ShoppingBag,
  Store,
  ChevronRight,
  MapPin,
  Bell,
  BookOpen,
  Headphones,
  Settings,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  Flag,
  LogOut,
} from 'lucide-react';

const rowClass =
  'flex items-center gap-3 w-full px-4 py-3.5 text-sm text-slate-800 hover:bg-slate-50 text-left';

export default function ProfilePage() {
  const router = useRouter();
  const { mode, setMode } = useAppMode();
  const { user, logout } = useLiff();
  const { nickname, avatar } = useProfile();
  const { shop, isShopSetup, credits } = useSeller();

  const isSeller = mode === 'SELLER';
  const displayName = isSeller && shop?.shopName ? shop.shopName : nickname || user.displayName;
  const displayAvatar = (isSeller && shop?.avatar) || avatar || user.pictureUrl;

  const oaId = process.env.NEXT_PUBLIC_LINE_OA_ID || 'gongdong';
  const oaHandle = oaId.startsWith('@') ? oaId : `@${oaId}`;

  const switchTo = (next: AppMode) => {
    if (next === mode) return;
    if (next === 'SELLER' && !isShopSetup) {
      // Mode flips once the shop wizard (incl. KYC) is finished.
      router.push('/seller/setup');
      return;
    }
    setMode(next);
    router.push(next === 'SELLER' ? '/seller' : '/');
  };

  const roles = [
    { id: 'BUYER' as const, label: 'โหมดผู้ซื้อ', icon: ShoppingBag },
    {
      id: 'SELLER' as const,
      label: isShopSetup ? 'โหมดผู้ขาย' : 'โหมดผู้ขาย · เปิดร้าน',
      icon: Store,
    },
  ];

  const modeMenu = isSeller
    ? [
        { href: '/seller/setup', label: 'แก้ไขข้อมูลร้าน', icon: Settings },
        { href: '/seller/credits', label: `เครดิตร้าน · เหลือ ${credits}`, icon: CreditCard },
        { href: '/seller/report', label: 'รายงานปัญหา', icon: Flag },
      ]
    : [
        { href: '/addresses', label: 'ที่อยู่จัดส่ง', icon: MapPin },
        { href: '/wishlist', label: 'หนังสือที่ฝากตามหา', icon: Bell },
      ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar title="โปรไฟล์" showBack={false} />

      <div className="p-4 space-y-4">
        {/* Identity */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <img
            src={displayAvatar}
            alt=""
            className={clsx(
              'w-14 h-14 rounded-full object-cover bg-slate-100 border-2',
              isSeller ? 'border-teal-500' : 'border-[#06C755]'
            )}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{displayName}</h1>
            <p className="text-[11px] text-slate-400">
              {isSeller ? 'กำลังใช้งานในฐานะผู้ขาย' : 'กำลังใช้งานในฐานะผู้ซื้อ'}
            </p>
          </div>
        </div>

        {/* Role switch */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-slate-400">สลับบทบาท</div>
          <div role="radiogroup" aria-label="สลับบทบาท">
            {roles.map((role) => {
              const active = mode === role.id;
              const Icon = role.icon;
              return (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => switchTo(role.id)}
                  className={clsx(
                    rowClass,
                    active &&
                      (role.id === 'SELLER'
                        ? 'bg-teal-50 text-teal-800 font-bold hover:bg-teal-50'
                        : 'bg-emerald-50 text-emerald-800 font-bold hover:bg-emerald-50')
                  )}
                >
                  <Icon className={clsx('w-4 h-4', !active && 'text-slate-500')} />
                  <span className="flex-1">{role.label}</span>
                  {active && <span className="text-[11px] font-bold">ใช้งานอยู่</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seller verification status */}
        {isSeller && shop && (
          <button
            type="button"
            onClick={() => router.push('/seller/setup?step=4')}
            className={clsx(
              'w-full flex items-center gap-2 p-3 rounded-xl border text-left',
              shop.payeeVerified ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
            )}
          >
            {shop.payeeVerified ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span
              className={clsx(
                'flex-1 text-[11px] leading-snug',
                shop.payeeVerified ? 'text-emerald-900' : 'text-amber-900'
              )}
            >
              {shop.payeeVerified && shop.kyc
                ? `ยืนยันตัวตนแล้ว · พร้อมเพย์ ${shop.kyc.promptPayMasked}`
                : 'ยังไม่ยืนยันตัวตน (KYC) · กดเพื่อยืนยัน'}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        )}

        {/* Mode-specific links */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {modeMenu.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={rowClass}>
                <Icon className="w-4 h-4 text-slate-500" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
            );
          })}
        </div>

        {/* Help + account */}
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <Link href="/help" className={rowClass}>
            <BookOpen className="w-4 h-4 text-slate-500" />
            <span className="flex-1">คู่มือการใช้งาน</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
          <a
            href={`https://line.me/R/ti/p/${oaHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className={rowClass}
          >
            <Headphones className="w-4 h-4 text-slate-500" />
            <span className="flex-1">ติดต่อเรา</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </a>
          <button type="button" onClick={logout} className={rowClass}>
            <LogOut className="w-4 h-4 text-slate-500" />
            <span className="flex-1">ออกจากระบบ</span>
          </button>
        </div>
      </div>

      <BottomTab />
    </div>
  );
}
