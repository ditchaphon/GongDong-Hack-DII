'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchBar, Chip, BookCard, EmptyState } from '@/components/ui';
import { BottomTab } from '@/components/layout/BottomTab';
import { api } from '@/lib/api';
import { BackendBookFeedItem, mapBackendBookToBook } from '@/lib/mappers';
import { Book } from '@/types';
import { Bell, Sparkles, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAppMode } from '@/hooks/useAppMode';
import { useLiff } from '@/hooks/useLiff';
import { useV4Orders } from '@/hooks/useV4Orders';

const HOME_FEED_CACHE_KEY = 'gongdong.homeFeedCache.v1';

function readHomeFeedCache(): Book[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HOME_FEED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Book[]) : null;
  } catch {
    return null;
  }
}

function writeHomeFeedCache(books: Book[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOME_FEED_CACHE_KEY, JSON.stringify(books));
  } catch {
    // ignore storage quota errors
  }
}

export interface HomeFeedClientProps {
  initialBooks: Book[];
}

export const HomeFeedClient: React.FC<HomeFeedClientProps> = ({ initialBooks }) => {
  const router = useRouter();
  const { isLoggedIn, idToken, user } = useLiff();
  const { mode, setMode } = useAppMode();
  const { items: cartItems } = useCart();
  const { activeBuyerCount } = useV4Orders();

  // Opening the buyer marketplace (e.g. from LINE OA Rich Menu) switches back to BUYER mode.
  useEffect(() => {
    if (mode !== 'BUYER') setMode('BUYER');
  }, [mode, setMode]);

  const [books, setBooks] = useState<Book[]>(initialBooks);
  const hasVisibleBooksRef = useRef<boolean>(initialBooks.length > 0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [homeSearch, setHomeSearch] = useState('');
  const [loading, setLoading] = useState(initialBooks.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const loadFeed = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const feedRes = await api.get<{ books: BackendBookFeedItem[]; total: number }>(
        '/api/books?limit=30'
      );
      const mapped = (feedRes.books ?? []).map(mapBackendBookToBook);
      setBooks(mapped);
      hasVisibleBooksRef.current = mapped.length > 0;
      writeHomeFeedCache(mapped);
    } catch (err) {
      if (!hasVisibleBooksRef.current) {
        setError(err instanceof Error ? err.message : 'โหลดรายการหนังสือไม่สำเร็จ');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialBooks.length > 0) {
      writeHomeFeedCache(initialBooks);
      // Quietly revalidate in background after SSR first paint
      void loadFeed(true);
      return;
    }

    const cached = readHomeFeedCache();
    if (cached && cached.length > 0) {
      setBooks(cached);
      hasVisibleBooksRef.current = true;
      setLoading(false);
      void loadFeed(true);
    } else {
      void loadFeed(false);
    }
  }, [initialBooks, loadFeed]);

  // Share unread badge count from InAppNotificationBanner so Home avoids a duplicate poll
  useEffect(() => {
    const userKey = user.id || user.lineUserId || '';
    if (!isLoggedIn || !idToken || !userKey) {
      setUnreadCount(0);
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(
        `gongdong.unreadNotifCount.${userKey}`
      );
      if (stored !== null) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed >= 0) setUnreadCount(parsed);
      }
    } catch {
      /* ignore */
    }
    const handleUnreadUpdate = (event: Event) => {
      const custom = event as CustomEvent<{ unreadCount?: number }>;
      if (typeof custom.detail?.unreadCount === 'number') {
        setUnreadCount(custom.detail.unreadCount);
      }
    };
    window.addEventListener('gongdong:notifications-unread', handleUnreadUpdate);
    return () => {
      window.removeEventListener('gongdong:notifications-unread', handleUnreadUpdate);
    };
  }, [isLoggedIn, idToken, user.id, user.lineUserId]);

  const categories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'นิยาย', label: 'นิยาย' },
    { id: 'วิชาการ', label: 'วิชาการ' },
    { id: 'การ์ตูน', label: 'การ์ตูน' },
    { id: 'หนังสือเรียน', label: 'หนังสือเรียน' },
  ];

  const filteredBooks = books.filter(
    (b) => activeCategory === 'all' || (b.categories ?? []).includes(activeCategory)
  );

  const handleHomeSearch = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#8B5E3C] text-white flex items-center justify-center font-bold text-base shadow-xs">
            ก
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-none">
              กองดอง
            </h1>
            <span className="text-[10px] text-slate-400 font-medium">
              ตลาดหนังสือมือสอง
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/notifications"
            aria-label="การแจ้งเตือน"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/cart"
            aria-label="ตะกร้า"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition relative"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#8B5E3C] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {cartItems.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Search Bar */}
      <div className="p-4 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar
              value={homeSearch}
              onChange={setHomeSearch}
              onSearch={handleHomeSearch}
              placeholder="ค้นชื่อหนังสือ ผู้แต่ง หรือ ISBN..."
            />
          </div>
          <button
            type="button"
            onClick={() => handleHomeSearch(homeSearch)}
            className="shrink-0 min-h-[44px] px-3.5 rounded-2xl bg-[#8B5E3C] text-white text-xs font-bold hover:bg-[#764e31] transition"
          >
            ค้นหา
          </button>
        </div>

        {/* Filter Categories */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-1">
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              selected={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
              size="sm"
            />
          ))}
        </div>
      </div>

      {/* Feed Content */}
      <div className="p-4 space-y-6">
        {/* Book Feed Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8B5E3C]" />
              หนังสือแนะนำคุณภาพดี
            </h2>
            <span className="text-xs text-slate-400">
              พบ {filteredBooks.length} เล่ม
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="h-56 rounded-2xl bg-slate-200 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <EmptyState
                title="โหลดรายการหนังสือไม่สำเร็จ"
                description={error}
                actionText="ลองใหม่"
                onAction={() => void loadFeed(false)}
              />
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isOwnBook={Boolean(user?.id && book.sellerId === user.id)}
                  onClick={() => router.push(`/book/${book.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <EmptyState
                title="ยังไม่มีหนังสือในหมวดนี้"
                description="ลองเลือกหมวดอื่น หรือค้นหาหนังสือที่ต้องการ"
                actionText="ค้นหาหนังสือ"
                onAction={() => router.push('/search')}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Navigation */}
      <BottomTab forceMode="BUYER" orderBadge={activeBuyerCount || undefined} />
    </div>
  );
};
