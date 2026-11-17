'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Bell, ChevronRight, Coins, Package, Store, ShoppingBag, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useLiff } from '@/hooks/useLiff';
import { useAppMode } from '@/hooks/useAppMode';
import { useSeller } from '@/hooks/useSeller';
import { useV4Orders } from '@/hooks/useV4Orders';
import type { BackendNotification } from '@/lib/mappers';

const POLL_INTERVAL_MS = 5000;
const AUTO_DISMISS_MS = 8000;
const INITIAL_FRESH_WINDOW_MS = 90_000;
const SEEN_STORAGE_PREFIX = 'gongdong.seenNotifPopups.v1.';
const MAX_STORED_SEEN_IDS = 100;

interface PopupNotification {
  id: string;
  role: 'BUYER' | 'SELLER';
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  createdAt: string;
}

function readSeenIds(userKey: string): string[] {
  if (!userKey || typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(`${SEEN_STORAGE_PREFIX}${userKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeenIds(userKey: string, ids: string[]): void {
  if (!userKey || typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${SEEN_STORAGE_PREFIX}${userKey}`,
      JSON.stringify(ids.slice(-MAX_STORED_SEEN_IDS))
    );
  } catch {
    // ignore storage errors
  }
}

export const InAppNotificationBanner: React.FC = () => {
  const router = useRouter();
  const { isReady, isLoggedIn, idToken, user } = useLiff();
  const { setMode } = useAppMode();
  const { isShopSetup, refreshSellerData } = useSeller();
  const { refreshOrders } = useV4Orders();

  const userKey = user.id || user.lineUserId || '';
  const [queue, setQueue] = useState<PopupNotification[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedForUserRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // Sync seen IDs from sessionStorage when user changes
  useEffect(() => {
    if (!userKey) {
      seenIdsRef.current = new Set();
      initializedForUserRef.current = null;
      setQueue([]);
      return;
    }
    seenIdsRef.current = new Set(readSeenIds(userKey));
    initializedForUserRef.current = null;
  }, [userKey]);

  const pollNotifications = useCallback(async () => {
    if (!isReady || !isLoggedIn || !idToken || !userKey) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const res = await api.get<{ items: BackendNotification[]; unreadCount: number }>(
        '/api/notifications?limit=10',
        { token: idToken }
      );
      const items = Array.isArray(res?.items) ? res.items : [];
      const unreadCount = res?.unreadCount ?? 0;
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(
            `gongdong.unreadNotifCount.${userKey}`,
            String(unreadCount)
          );
        } catch {
          /* ignore storage errors */
        }
        window.dispatchEvent(
          new CustomEvent('gongdong:notifications-unread', {
            detail: { unreadCount },
          })
        );
      }
      const isFirstPollForSession = initializedForUserRef.current !== userKey;
      const nowMs = Date.now();
      const freshPopups: PopupNotification[] = [];

      // Process oldest -> newest so queue preserves chronological order
      for (const item of [...items].reverse()) {
        if (seenIdsRef.current.has(item.id)) continue;
        seenIdsRef.current.add(item.id);

        if (item.isRead) continue;
        const createdMs = new Date(item.createdAt).getTime();
        const isRecent =
          Number.isFinite(createdMs) && nowMs - createdMs <= INITIAL_FRESH_WINDOW_MS;

        if (!isFirstPollForSession || isRecent) {
          freshPopups.push({
            id: item.id,
            role: item.role?.toUpperCase() === 'SELLER' ? 'SELLER' : 'BUYER',
            type: item.type?.toUpperCase() || 'SYSTEM',
            title: item.title,
            message: item.message,
            linkUrl: item.linkUrl,
            createdAt: item.createdAt,
          });
        }
      }

      initializedForUserRef.current = userKey;
      writeSeenIds(userKey, Array.from(seenIdsRef.current));

      if (freshPopups.length > 0) {
        setQueue((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = freshPopups.filter((p) => !existingIds.has(p.id));
          return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
        });

        // Keep in-app order lists and seller counts fresh immediately
        if (freshPopups.some((p) => p.type === 'ORDER')) {
          void refreshOrders();
          if (freshPopups.some((p) => p.role === 'SELLER') && isShopSetup) {
            void refreshSellerData();
          }
        }
      }
    } catch {
      // Silent retry on next poll interval
    } finally {
      inFlightRef.current = false;
    }
  }, [
    isReady,
    isLoggedIn,
    idToken,
    userKey,
    isShopSetup,
    refreshOrders,
    refreshSellerData,
  ]);

  // Poll every 5 seconds while tab/LIFF webview is visible
  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken || !userKey) return;

    void pollNotifications();
    const timer = window.setInterval(() => {
      void pollNotifications();
    }, POLL_INTERVAL_MS);

    const handleWake = () => {
      if (document.visibilityState === 'visible') {
        void pollNotifications();
      }
    };
    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
    };
  }, [isReady, isLoggedIn, idToken, userKey, pollNotifications]);

  const active = queue[0] ?? null;

  const dismissActive = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Auto-dismiss active banner after 8 seconds
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(dismissActive, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [active, dismissActive]);

  if (!active) return null;

  const isSellerNotif = active.role === 'SELLER';
  const targetUrl = active.linkUrl || '/notifications';

  const handleOpen = () => {
    if (idToken) {
      void api
        .patch(`/api/notifications/${encodeURIComponent(active.id)}/read`, undefined, {
          token: idToken,
        })
        .catch(() => undefined);
    }
    if (isSellerNotif && isShopSetup) {
      setMode('SELLER');
    } else if (!isSellerNotif) {
      setMode('BUYER');
    }
    dismissActive();
    router.push(targetUrl);
  };

  const Icon =
    active.type === 'ORDER'
      ? Package
      : active.type === 'CREDIT'
      ? Coins
      : Bell;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-[414px] pointer-events-auto"
      style={{ top: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
        className={clsx(
          'animate-slide-down w-full text-left rounded-2xl border bg-white/95 backdrop-blur-md shadow-xl p-3 flex items-start gap-2.5 cursor-pointer active:scale-[0.99] transition',
          isSellerNotif ? 'border-teal-300 ring-2 ring-teal-500/15' : 'border-emerald-300 ring-2 ring-[#8B5E3C]/15'
        )}
      >
        <div
          className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
            isSellerNotif
              ? 'bg-teal-50 text-teal-700 border border-teal-200'
              : 'bg-emerald-50 text-[#8B5E3C] border border-emerald-200'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                isSellerNotif
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-amber-50 text-[#6B4628] border-amber-200'
              )}
            >
              {isSellerNotif ? (
                <Store className="w-2.5 h-2.5" />
              ) : (
                <ShoppingBag className="w-2.5 h-2.5" />
              )}
              {isSellerNotif ? 'แจ้งเตือนผู้ขาย' : 'แจ้งเตือนผู้ซื้อ'}
            </span>
            <span className="text-[10px] text-slate-400">เมื่อสักครู่</span>
          </div>

          <p className="text-xs font-extrabold text-slate-900 line-clamp-1">
            {active.title}
          </p>
          <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug mt-0.5">
            {active.message}
          </p>

          <div
            className={clsx(
              'inline-flex items-center gap-0.5 text-[11px] font-bold mt-1.5',
              isSellerNotif ? 'text-teal-700' : 'text-[#8B5E3C]'
            )}
          >
            <span>{active.linkUrl?.startsWith('/orders') ? 'แตะเพื่อเปิดหน้าออเดอร์' : 'แตะเพื่อดูรายละเอียด'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <button
          type="button"
          aria-label="ปิดการแจ้งเตือน"
          onClick={(e) => {
            e.stopPropagation();
            dismissActive();
          }}
          className="p-1.5 -mr-1 -mt-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
