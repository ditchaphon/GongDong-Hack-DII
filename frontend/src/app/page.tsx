'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchBar, Chip, BookCard, BottomSheet } from '@/components/ui';
import { BottomTab } from '@/components/layout/BottomTab';
import { MOCK_BOOKS } from '@/mocks/books';
import { Book } from '@/types';
import { Bell, MoreHorizontal, X, MapPin, Sparkles, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function HomePage() {
  const router = useRouter();
  const { items: cartItems } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isLiffMenuOpen, setIsLiffMenuOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'meetup', label: '🤝 นัดรับ มช. ฿0', isHighlight: true },
    { id: 'parcel', label: '📦 ส่งพัสดุ' },
    { id: 'self-help', label: 'พัฒนาตนเอง' },
    { id: 'manga', label: 'การ์ตูนยกชุด' },
  ];

  const filteredBooks = MOCK_BOOKS.filter((b) => {
    if (activeCategory === 'meetup') return b.deliveryMethods.includes('MEETUP');
    if (activeCategory === 'parcel') return b.deliveryMethods.includes('PARCEL');
    if (activeCategory === 'manga') return b.isSet;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#06C755] text-white flex items-center justify-center font-bold text-base shadow-xs">
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
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </Link>

          <Link
            href="/cart"
            aria-label="ตะกร้า"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition relative"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-4 h-4 px-1 rounded-full bg-[#06C755] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {cartItems.length}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setIsLiffMenuOpen(true)}
            aria-label="เมนู LIFF"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Search Bar Hotspot (Clicks to /search) */}
      <div className="p-4 bg-white border-b border-slate-100">
        <div
          role="button"
          tabIndex={0}
          onClick={() => router.push('/search')}
          className="cursor-pointer"
        >
          <SearchBar
            placeholder="🔍 ค้นชื่อหนังสือ ผู้แต่ง หรือ ISBN..."
            disabled
          />
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
        {/* Banner: Meetup Trust Highlight */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full inline-block">
              Free Meetup
            </span>
            <h3 className="font-bold text-base">นัดรับใน มช. ฿0 บาท</h3>
            <p className="text-xs text-white/90">
              ปักหมุดจุดนัดเองได้ • ดูของจริงก่อนจ่าย • ไม่ต้องให้เบอร์โทร
            </p>
          </div>
          <div className="p-3 bg-white/10 backdrop-blur-xs rounded-2xl shrink-0">
            <MapPin className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Book Feed Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#06C755]" />
              หนังสือแนะนำสภาพดี
            </h2>
            <span className="text-xs text-slate-400">
              พบ {filteredBooks.length} เล่ม
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => router.push(`/book/${book.id}`)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* LIFF Menu BottomSheet (M1 in Figma) */}
      <BottomSheet
        isOpen={isLiffMenuOpen}
        onClose={() => setIsLiffMenuOpen(false)}
        title="เมนูตัวเลือก"
      >
        <div className="space-y-2 py-1">
          <Link
            href="/help"
            onClick={() => setIsLiffMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">วิธีใช้งาน & ช่วยเหลือ</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
          <Link
            href="/profile"
            onClick={() => setIsLiffMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">โปรไฟล์ / สลับโหมดผู้ขาย</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
          <Link
            href="/onboarding"
            onClick={() => setIsLiffMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">แนะนำวิธีใช้งาน (Onboarding)</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
          <Link
            href="/design-system"
            onClick={() => setIsLiffMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">Design System Library</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
          <Link
            href="/debug"
            onClick={() => setIsLiffMenuOpen(false)}
            className="flex items-center justify-between p-3.5 rounded-xl hover:bg-slate-50 border border-slate-100"
          >
            <span className="text-sm font-medium text-slate-800">LIFF Diagnostics / Debug</span>
            <span className="text-xs text-slate-400">→</span>
          </Link>
        </div>
      </BottomSheet>

      {/* Fixed Bottom Navigation */}
      <BottomTab orderBadge={1} />
    </div>
  );
}
