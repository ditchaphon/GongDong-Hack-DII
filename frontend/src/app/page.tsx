'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchBar, Chip, BookCard, EmptyState } from '@/components/ui';
import { BottomTab } from '@/components/layout/BottomTab';
import { api } from '@/lib/api';
import { BackendBookFeedItem, BackendNotification, mapBackendBookToBook } from '@/lib/mappers';
import { Book } from '@/types';
import { Bell, BookOpen, ChevronRight, Sparkles, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useLiff } from '@/hooks/useLiff';
import { useV4Orders } from '@/hooks/useV4Orders';
import { isTerminal } from '@/lib/orderStateMachine';

export default function HomePage() {
  const router = useRouter();
  const { isReady, isLoggedIn, idToken } = useLiff();
  const { items: cartItems } = useCart();
  const { orders, isMineAsBuyer } = useV4Orders();
  const [books, setBooks] = useState<Book[]>([]);
  const [recommendedBook, setRecommendedBook] = useState<Book | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [homeSearch, setHomeSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const loadFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const [feedRes, recRes] = await Promise.all([
        api.get<{ books: BackendBookFeedItem[]; total: number }>('/api/books?limit=30'),
        api
          .get<{ books: BackendBookFeedItem[] }>('/api/books/recommended?limit=1')
          .catch(() => ({ books: [] })),
      ]);
      const mapped = (feedRes.books ?? []).map(mapBackendBookToBook);
      setBooks(mapped);
      const rec = recRes.books?.[0] ? mapBackendBookToBook(recRes.books[0]) : null;
      setRecommendedBook(rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดรายการหนังสือไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) {
      setUnreadCount(0);
      return;
    }
    let active = true;
    api
      .get<{ items: BackendNotification[]; unreadCount: number }>(
        '/api/notifications?limit=1',
        { token: idToken }
      )
      .then((res) => {
        if (active) setUnreadCount(res.unreadCount ?? 0);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });
    return () => {
      active = false;
    };
  }, [isReady, isLoggedIn, idToken]);

  const categories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'meetup', label: '🤝 นัดรับ ฿0', isHighlight: true },
    { id: 'parcel', label: '📦 ส่งพัสดุ' },
    { id: 'นิยาย', label: 'นิยาย' },
    { id: 'วิชาการ', label: 'วิชาการ' },
    { id: 'การ์ตูน', label: 'การ์ตูน' },
    { id: 'หนังสือเรียน', label: 'หนังสือเรียน' },
  ];

  const filteredBooks = books.filter((b) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'meetup') return b.deliveryMethods.includes('MEETUP');
    if (activeCategory === 'parcel') return b.deliveryMethods.includes('PARCEL');
    return (b.categories ?? []).includes(activeCategory);
  });

  const handleHomeSearch = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    router.push(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search');
  };

  const spotlightBook = filteredBooks[0] ?? recommendedBook ?? books[0] ?? null;
  const activeCategoryLabel =
    categories.find((category) => category.id === activeCategory)?.label ?? 'ทั้งหมด';
  const activeBuyerOrderCount = orders.filter(
    (o) => isMineAsBuyer(o) && !isTerminal(o.status)
  ).length;

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
        <div className="flex gap-2 overflow-x-auto pt-3 pb-1 no-scrollbar">
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              selected={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
              size="sm"
              className={c.isHighlight && activeCategory !== c.id ? 'border-teal-300 text-teal-800 bg-teal-50' : ''}
            />
          ))}
        </div>
      </div>

      {/* Feed Content */}
      <div className="p-4 space-y-6">
        {spotlightBook && (
          <button
            type="button"
            onClick={() => router.push(`/book/${spotlightBook.id}`)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-[#8B5E3C] to-[#B07A50] text-white shadow-xs flex items-center gap-3"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block">
                แนะนำสำหรับคุณ
              </span>
              <h3 className="font-bold text-base">เรื่องนี้คุณอาจสนใจ</h3>
              <p className="text-xs text-white/90 line-clamp-1">{spotlightBook.title}</p>
              <p className="text-[11px] text-white/75 line-clamp-1">
                {spotlightBook.grade} · ฿{spotlightBook.price.toLocaleString()} · {activeCategoryLabel}
              </p>
            </div>
            <div className="w-14 h-16 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 overflow-hidden">
              {spotlightBook.photos?.cover ? (
                <img
                  src={spotlightBook.photos.cover}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen className="w-6 h-6 text-white" />
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          </button>
        )}

        {/* Book Feed Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8B5E3C]" />
              หนังสือแนะนำสภาพดี
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
                onAction={loadFeed}
              />
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
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
      <BottomTab orderBadge={activeBuyerOrderCount || undefined} />
    </div>
  );
}
