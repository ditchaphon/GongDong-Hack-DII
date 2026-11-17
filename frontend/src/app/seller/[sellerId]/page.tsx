'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BookCard, Button, EmptyState, Toast } from '@/components/ui';
import { ConfirmSheet } from '@/components/v4';
import { useLiff } from '@/hooks/useLiff';
import { api } from '@/lib/api';
import {
  BackendPublicShopResponse,
  BackendReviewsResponse,
  mapPublicShopListingsToBooks,
  mapPublicShopToShopProfile,
} from '@/lib/mappers';
import { Book, ShopProfile } from '@/types';
import {
  Star,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Flag,
  MessageCircle,
  Truck,
  CalendarDays,
} from 'lucide-react';

export default function SellerShopPage({
  params,
}: {
  params: Promise<{ sellerId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useLiff();

  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [sellerBooks, setSellerBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadShop = async () => {
      setLoading(true);
      setError(null);
      try {
        const shopRes = await api.get<BackendPublicShopResponse>(
          `/api/shops/${resolvedParams.sellerId}`
        );
        const sellerUserId = shopRes.seller_id || resolvedParams.sellerId;
        const reviewsRes = await api
          .get<BackendReviewsResponse>(`/api/users/${sellerUserId}/reviews`)
          .catch(() => null);
        if (!active) return;
        const mappedShop = mapPublicShopToShopProfile(shopRes, reviewsRes);
        setShop(mappedShop);
        setSellerBooks(mapPublicShopListingsToBooks(shopRes));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'ไม่พบข้อมูลร้านค้า');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadShop();
    return () => {
      active = false;
    };
  }, [resolvedParams.sellerId]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
        <TopBar title="ร้านค้า" />
        <div className="p-4 space-y-4">
          <div className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-56 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-56 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
        <TopBar title="ร้านค้า" />
        <div className="p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              title="ไม่พบร้านค้านี้"
              description={error || 'ร้านอาจถูกปิดหรือยังไม่ได้ตั้งค่าร้าน'}
              actionText="กลับหน้าหลัก"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  const sellerInfo = sellerBooks[0];
  const hasLongDescription = Boolean(
    shop.description &&
      (shop.description.length > 140 || shop.description.split('\n').length > 3)
  );
  const hasDeliverySchedule = Boolean(
    shop.meetupPoints.length > 0 ||
      shop.availableDays.length > 0 ||
      shop.availableSlots.length > 0 ||
      shop.supportsParcel
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
      <TopBar
        title="ร้านค้า"
        rightAction={
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            aria-label="รายงานร้าน"
            className="p-2 text-slate-500 hover:text-rose-500 rounded-full hover:bg-slate-100"
          >
            <Flag className="w-5 h-5" />
          </button>
        }
      />

      {/* Shop header */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-4">
        <div className="flex items-center gap-4">
          {shop.avatar || sellerInfo?.photos.cover ? (
            <img
              src={shop.avatar || sellerInfo?.photos.cover}
              alt={shop.shopName}
              className="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#8B5E3C] text-white flex items-center justify-center font-bold text-xl shrink-0">
              {shop.shopName.slice(0, 1)}
            </div>
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 leading-snug truncate">
              {shop.shopName}
            </h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
              <span className="flex items-center font-bold">
                {shop.rating > 0 ? (
                  <span className="flex items-center text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400 mr-1" />
                    {shop.rating.toFixed(1)} / 5.0
                  </span>
                ) : (
                  <span className="flex items-center text-slate-400 font-semibold">
                    <Star className="w-3.5 h-3.5 stroke-slate-300 mr-1" />
                    ยังไม่มีคะแนน
                  </span>
                )}
              </span>
              <span>•</span>
              <span>ขายแล้ว {shop.completedSales} ครั้ง</span>
              {shop.memberSince && (
                <>
                  <span>•</span>
                  <span>สมาชิกตั้งแต่ {shop.memberSince}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {shop.description && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <p
              className={`text-xs text-slate-700 leading-relaxed whitespace-pre-line ${
                !showFullDesc ? 'line-clamp-3' : ''
              }`}
            >
              {shop.description}
            </p>
            {hasLongDescription && (
              <button
                type="button"
                onClick={() => setShowFullDesc((prev) => !prev)}
                className="text-[11px] font-semibold text-teal-700 hover:underline"
              >
                {showFullDesc ? 'ย่อลง' : 'อ่านเพิ่มเติม'}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
          {shop.payeeVerified ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              ยืนยันตัวตนแล้ว
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              ยังไม่ยืนยันตัวตน · นัดรับเท่านั้น
            </span>
          )}
          {shop.meetupPoints.length ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
              <MapPin className="w-3 h-3" />
              นัดรับ {shop.meetupPoints.length} จุด · {shop.province}
            </span>
          ) : null}
          {shop.supportsParcel && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              <Truck className="w-3 h-3" />
              ส่งพัสดุได้
            </span>
          )}
        </div>

        {hasDeliverySchedule && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
            {shop.meetupPoints.length > 0 && (
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">จุดนัดรับ ({shop.province}): </span>
                  <span>
                    {shop.meetupPoints
                      .map((p) => (p.note ? `${p.name} (${p.note})` : p.name))
                      .join(' · ')}
                  </span>
                </div>
              </div>
            )}
            {(shop.availableDays.length > 0 || shop.availableSlots.length > 0) && (
              <div className="flex items-start gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">วัน-เวลาที่สะดวก: </span>
                  <span>
                    {shop.availableDays.length > 0 ? shop.availableDays.join(', ') : ''}
                    {shop.availableDays.length > 0 && shop.availableSlots.length > 0 ? ' · ' : ''}
                    {shop.availableSlots.length > 0 ? shop.availableSlots.join(', ') : ''}
                  </span>
                </div>
              </div>
            )}
            {shop.supportsParcel && (
              <div className="flex items-start gap-1.5">
                <Truck className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">รอบจัดส่งพัสดุ: </span>
                  <span>
                    {shop.shipMode === 'DAILY'
                      ? 'ส่งทุกวัน'
                      : `จัดส่งภายใน ${shop.shipWithinDays} วันหลังรับออเดอร์`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
          <span>ซื้อหลายเล่มจากร้านเดียวกัน ค่าส่งที่ระบบคำนวณจะถูกกว่า</span>
        </div>
      </div>

      {/* Listings */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            หนังสือในร้าน ({sellerBooks.length} เล่ม)
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {sellerBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isOwnBook={Boolean(user?.id && book.sellerId === user.id)}
              onClick={() => router.push(`/book/${book.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">รีวิวจากผู้ซื้อ</h2>
          <span className="text-[11px] text-slate-400">
            {shop?.reviews.length ?? 0} รีวิว
          </span>
        </div>

        {shop?.reviews.length ? (
          shop.reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {review.avatar ? (
                    <img
                      src={review.avatar}
                      alt={review.author}
                      className="w-6 h-6 rounded-full object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                  )}
                  <span className="text-[11px] font-semibold text-slate-800">
                    {review.author}
                  </span>
                </div>
                <span className="flex items-center text-amber-500 text-[10px] font-bold">
                  <Star className="w-3 h-3 fill-amber-400 stroke-amber-400 mr-0.5" />
                  {review.rating}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{review.comment}</p>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{review.createdAt}</span>
                {review.gradeMatched && (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <ShieldCheck className="w-3 h-3" />
                    คุณภาพตรงเกรด
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <MessageCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
            <p className="text-[11px] text-slate-500">ยังไม่มีรีวิวสำหรับร้านนี้</p>
          </div>
        )}
      </div>

      <div className="px-4">
        <Button
          variant="outline"
          fullWidth
          leftIcon={<Flag className="w-4 h-4" />}
          onClick={() => setIsReportOpen(true)}
        >
          รายงานร้านนี้
        </Button>
      </div>

      <ConfirmSheet
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title="รายงานร้านนี้ · ฟีเจอร์กำลังพัฒนา"
        description="ระบบส่งรายงานร้านค้าอัตโนมัติกำลังพัฒนา หากพบร้านค้าที่น่าสงสัย รูปปลอม หรือชวนโอนนอกระบบ สามารถแจ้งทีมงานผ่านหน้าช่วยเหลือได้ทันที"
        confirmLabel="ไปหน้าช่วยเหลือ"
        cancelLabel="ปิด"
        onConfirm={() => {
          setIsReportOpen(false);
          router.push('/help');
        }}
      >
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          ร้าน: {shop?.shopName || sellerInfo?.sellerName || 'ร้านค้ากองดอง'}
        </div>
      </ConfirmSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
