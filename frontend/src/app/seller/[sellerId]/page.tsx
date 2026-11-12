'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BookCard, TrustBadge } from '@/components/ui';
import { MOCK_BOOKS } from '@/mocks/books';
import { Star, MapPin, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';

export default function SellerShopPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const sellerBooks = MOCK_BOOKS.filter(
    (b) => b.sellerId === resolvedParams.sellerId
  );
  const sellerInfo = sellerBooks[0] || MOCK_BOOKS[0];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
      <TopBar title={`ร้าน ${sellerInfo.sellerName}`} />

      {/* Seller Header Profile Card */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-4">
        <div className="flex items-center gap-4">
          <img
            src={sellerInfo.sellerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={sellerInfo.sellerName}
            className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 shadow-xs"
          />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900 leading-snug">
              {sellerInfo.sellerName}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="flex items-center text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400 mr-1" />
                {sellerInfo.sellerRating} / 5.0
              </span>
              <span>•</span>
              <span>สมาชิกตั้งแต่ 2568</span>
            </div>
          </div>
        </div>

        {/* Verification trust badges */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          <TrustBadge type="promptpay" />
          <TrustBadge type="blacklist" />
          <TrustBadge type="meetup" />
        </div>

        {/* Bundle cart promotion banner */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#06C755] shrink-0" />
          <span>
            สั่งซื้อหลายเล่มจากร้านเดียวกัน เหมาค่าจัดส่งประหยัดกว่า
          </span>
        </div>
      </div>

      {/* Seller's Available Books */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            หนังสือทั้งหมดในร้าน ({sellerBooks.length} เล่ม)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sellerBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => router.push(`/book/${book.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

