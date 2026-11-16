'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  GradeBadge,
  ConditionChecklist,
  EmptyState,
  Modal,
  Toast,
} from '@/components/ui';
import { PhotoGallery, ConfirmSheet, CartAddedSheet, CartAddedState } from '@/components/v4';
import { calcParcelFee, countSetActualVolumes } from '@/lib/delivery';
import { toUiBookGrade } from '@/lib/catalog';
import { api } from '@/lib/api';
import {
  BackendBookDetail,
  BackendPublicShopResponse,
  BackendReviewsResponse,
  mapBackendBookDetailToBook,
  mapPublicShopToShopProfile,
} from '@/lib/mappers';
import { Book, ShopProfile } from '@/types';
import { useCart } from '@/hooks/useCart';
import { useLiff } from '@/hooks/useLiff';
import {
  Share2,
  MapPin,
  Truck,
  Star,
  ShieldCheck,
  ChevronRight,
  Info,
  Maximize2,
  Flag,
  Store,
  CheckCircle2,
  CalendarDays,
  ZoomIn,
  AlertTriangle,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';

type CompareSortKey = 'PRICE' | 'GRADE' | 'PICKUP';

interface IsbnCompareOffer {
  id: string;
  title: string;
  coverImageUrl: string;
  price: number;
  originalPrice: number | null;
  priceDiff: number;
  grade: 'LIKE_NEW' | 'GENTLY_READ' | 'WELL_LOVED' | 'WORN_BUT_READABLE';
  defectCount: number;
  isSet: boolean;
  totalVolumes: number | null;
  missingVolumes?: number[];
  allowPickup: boolean;
  pickupLocationName: string | null;
  allowDelivery: boolean;
  codEnabled: boolean;
  isCheapest: boolean;
  isBestGrade: boolean;
  isSameSeller: boolean;
  seller: {
    id: string;
    nickname: string;
    shopName: string | null;
    province: string | null;
    avatarUrl: string | null;
    isVerifiedSeller: boolean;
    rating: number;
    reviewCount: number;
    conditionAccuratePercent: number | null;
  };
}

interface BookIsbnCompareResult {
  currentBookId: string;
  isbn: string;
  isSyntheticIsbn: boolean;
  currentPrice: number;
  currentGrade: 'LIKE_NEW' | 'GENTLY_READ' | 'WELL_LOVED' | 'WORN_BUT_READABLE';
  isCurrentCheapest: boolean;
  isCurrentBestGrade: boolean;
  cheapestOfferPrice: number | null;
  totalOffers: number;
  offers: IsbnCompareOffer[];
}

const COMPARE_GRADE_RANK: Record<IsbnCompareOffer['grade'], number> = {
  LIKE_NEW: 4,
  GENTLY_READ: 3,
  WELL_LOVED: 2,
  WORN_BUT_READABLE: 1,
};

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useLiff();
  const { addToCart, items: cartItems, shopGroups } = useCart();

  const [book, setBook] = useState<Book | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [compareData, setCompareData] = useState<BookIsbnCompareResult | null>(null);
  const [compareSort, setCompareSort] = useState<CompareSortKey>('PRICE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartSheet, setCartSheet] = useState<CartAddedState | null>(null);

  useEffect(() => {
    let active = true;
    const loadBook = async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await api.get<BackendBookDetail>(`/api/books/${resolvedParams.id}`);
        const mappedBook = mapBackendBookDetailToBook(detail);
        if (!active) return;
        setBook(mappedBook);

        const sellerId = mappedBook.sellerId;
        const [shopRes, reviewsRes, compareRes] = await Promise.all([
          sellerId
            ? api.get<BackendPublicShopResponse>(`/api/shops/${sellerId}`).catch(() => null)
            : Promise.resolve(null),
          sellerId
            ? api.get<BackendReviewsResponse>(`/api/users/${sellerId}/reviews`).catch(() => null)
            : Promise.resolve(null),
          api
            .get<BookIsbnCompareResult>(`/api/books/${resolvedParams.id}/compare`)
            .catch(() => null),
        ]);
        if (!active) return;
        if (shopRes) {
          setShop(mapPublicShopToShopProfile(shopRes, reviewsRes));
        }
        setCompareData(compareRes);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'ไม่พบหนังสือเล่มนี้');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadBook();
    return () => {
      active = false;
    };
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
        <TopBar title="รายละเอียดหนังสือ" />
        <div className="w-full aspect-square bg-slate-200 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-7 w-1/3 bg-slate-200 rounded animate-pulse" />
          <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
          <div className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
        <TopBar title="รายละเอียดหนังสือ" />
        <div className="p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              title="ไม่พบหนังสือเล่มนี้"
              description={error || 'รายการอาจถูกลบหรือขายออกแล้ว'}
              actionText="กลับหน้าหลัก"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  const baseAnglePhotos = [
    { src: book.photos.cover, label: 'ปกหน้า', isDefect: false },
    { src: book.photos.back, label: 'ปกหลัง', isDefect: false },
    { src: book.photos.spine, label: 'สันหนังสือ', isDefect: false },
    ...(book.photos.nameTag
      ? [{ src: book.photos.nameTag, label: 'หน้าด้านใน', isDefect: false }]
      : []),
  ];

  const defectStartIndex = baseAnglePhotos.length;

  const photoList = [
    ...baseAnglePhotos,
    ...(book.defects || []).map((defect, idx) => ({
      src: defect.photo,
      label: defect.label || `จุดตำหนิ #${idx + 1}`,
      note: defect.label,
      isDefect: true,
    })),
  ];

  const sameShopCount = cartItems.filter((item) => item.sellerId === book.sellerId).length;
  const isBookAvailable = !book.status || book.status === 'AVAILABLE';
  const isOwnBook = Boolean(user?.id && book.sellerId === user.id);

  const handleAddToCart = () => {
    if (isOwnBook) {
      setToastMessage('ไม่สามารถเพิ่มหนังสือของตัวเองลงตะกร้าได้');
      return;
    }
    if (!isBookAvailable) {
      setToastMessage('หนังสือเล่มนี้ถูกจองหรือขายไปแล้ว');
      return;
    }
    const res = addToCart(book);
    if (res.success) {
      const nextShopCount = shopGroups.some((g) => g.sellerId === book.sellerId)
        ? shopGroups.length
        : shopGroups.length + 1;
      setCartSheet({
        kind: 'ADDED',
        book,
        count: sameShopCount + 1,
        totalCount: cartItems.length + 1,
        shopCount: nextShopCount,
      });
    } else if (res.reason === 'OWN_BOOK') {
      setToastMessage(res.message || 'ไม่สามารถเพิ่มหนังสือของตัวเองลงตะกร้าได้');
    } else {
      setCartSheet({
        kind: 'DUPLICATE',
        book,
        count: sameShopCount,
        totalCount: cartItems.length,
        shopCount: shopGroups.length,
      });
    }
  };

  const handleBuyNow = () => {
    if (isOwnBook) {
      setToastMessage('ไม่สามารถสั่งซื้อหนังสือของตัวเองได้');
      return;
    }
    if (!isBookAvailable) {
      setToastMessage('หนังสือเล่มนี้ถูกจองหรือขายไปแล้ว');
      return;
    }
    router.push(`/cart?buyNow=${encodeURIComponent(book.id)}`);
  };

  const offersMeetup = book.deliveryMethods.includes('MEETUP') && (shop ? shop.meetupPoints.length > 0 : (book.meetupZones?.length ?? 0) > 0);
  const offersParcel =
    book.deliveryMethods.includes('PARCEL') && (shop ? shop.supportsParcel && shop.payeeVerified : true);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('คัดลอกลิงก์แล้ว');
    } catch {
      setToastMessage('เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกลิงก์');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar
        title="รายละเอียดหนังสือ"
        rightAction={
          <button
            type="button"
            onClick={handleShare}
            aria-label="แชร์"
            className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
          >
            <Share2 className="w-5 h-5" />
          </button>
        }
      />

      {/* Photo gallery (watermarked, v4, tap to zoom) */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsGalleryOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setIsGalleryOpen(true);
        }}
        className="relative w-full aspect-square bg-slate-900 overflow-hidden cursor-zoom-in group"
      >
        <img
          src={photoList[activePhotoIdx]?.src || book.photos.cover}
          alt={book.title}
          className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform"
        />

        {photoList[activePhotoIdx]?.isDefect && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 bg-amber-500/95 text-slate-950 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md">
            <AlertTriangle className="w-3.5 h-3.5" /> จุดตำหนิที่ผู้ขายแจ้ง
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsGalleryOpen(true);
          }}
          className="absolute top-3 right-3 px-2.5 py-1.5 rounded-full bg-black/55 text-white backdrop-blur-xs hover:bg-black/75 transition inline-flex items-center gap-1.5 text-[11px] font-semibold"
          aria-label="ซูมดูภาพขนาดใหญ่"
        >
          <ZoomIn className="w-3.5 h-3.5" /> ซูมดูภาพ
        </button>

        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-full font-mono">
          {activePhotoIdx + 1} / {photoList.length}
        </div>

        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-full font-medium max-w-[65%] truncate">
          {photoList[activePhotoIdx]?.label}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 p-3 bg-white border-b border-slate-100 overflow-x-auto">
        {photoList.map((photo, index) => (
          <button
            key={`${photo.src}-${index}`}
            type="button"
            onClick={() => setActivePhotoIdx(index)}
            aria-label={`ดูรูปที่ ${index + 1}: ${photo.label}`}
            className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 ${
              activePhotoIdx === index
                ? photo.isDefect
                  ? 'border-amber-500 ring-2 ring-amber-400/30'
                  : 'border-[var(--color-primary)]'
                : 'border-transparent opacity-60 hover:opacity-90'
            }`}
          >
            <img src={photo.src} alt="" className="w-full h-full object-cover" />
            {photo.isDefect && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
            )}
          </button>
        ))}
      </div>

      {/* Metadata */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setIsGradeModalOpen(true)}>
            <GradeBadge grade={book.grade} size="lg" />
          </button>
          {book.isSet && (
            <span className="text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
              {book.missingVolumes && book.missingVolumes.length > 0 && book.totalVolumes
                ? `ต้องการขาย ${countSetActualVolumes(book)} จาก ${book.totalVolumes} เล่ม`
                : `ต้องการขาย ${countSetActualVolumes(book)} เล่ม`}
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 leading-snug">{book.title}</h1>

        {book.categories && book.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {book.categories.map((category) => (
              <span
                key={category}
                className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-800"
              >
                {category}
              </span>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-500 space-y-0.5">
          <p>
            ผู้แต่ง: <span className="font-medium text-slate-800">{book.author}</span>
          </p>
          {book.publisher && (
            <p>
              สำนักพิมพ์:{' '}
              <span className="font-medium text-slate-800">{book.publisher}</span>
            </p>
          )}
          {book.isbn && (
            <p>
              ISBN: <span className="font-mono text-slate-800">{book.isbn}</span>
            </p>
          )}
          {book.course && (
            <p>
              รายวิชา: <span className="font-medium text-slate-800">{book.course}</span>
            </p>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-50">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--color-primary)]">
              ฿{book.price.toLocaleString()}
            </span>
            {book.originalPrice && (
              <>
                <span className="text-sm text-slate-400 line-through">
                  ฿{book.originalPrice.toLocaleString()}
                </span>
                <span className="text-xs font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                  ลด {Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100)}%
                </span>
              </>
            )}
          </div>
          {book.isSet && (
            <p className="text-xs font-semibold text-purple-700">
              ชุด {countSetActualVolumes(book)} เล่ม · เฉลี่ย ~฿
              {Math.round(book.price / countSetActualVolumes(book)).toLocaleString()}/เล่ม
            </p>
          )}
          {book.isSet && book.missingVolumes && book.missingVolumes.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-bold">
                ชุดนี้ขาดเล่ม: {[...book.missingVolumes].sort((a, b) => a - b).map((v) => `เล่ม ${v}`).join(', ')}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                ผู้ซื้อจะได้รับทั้งหมด {countSetActualVolumes(book)} เล่ม
                {book.totalVolumes ? ` (จากปกติ ${book.totalVolumes} เล่ม)` : ''}
              </p>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-400">
          ราคามือหนึ่ง {book.originalPrice ? `฿${book.originalPrice.toLocaleString()}` : 'ไม่ระบุ'} ·{' '}
          {compareData && !compareData.isSyntheticIsbn && compareData.totalOffers > 0 ? (
            <a href="#isbn-compare" className="text-sky-600 font-semibold hover:underline">
              เทียบกับอีก {compareData.totalOffers} ร้านที่ขายเล่มนี้ ↓
            </a>
          ) : (
            'เทียบราคาและสภาพกับร้านอื่นด้านล่าง'
          )}
        </p>
        {book.description && (
          <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-50 whitespace-pre-line">
            {book.description}
          </p>
        )}
      </div>

      {/* Delivery options — shown before the condition report */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">วิธีรับหนังสือจากร้านนี้</h2>
          <span className="text-[11px] text-slate-400">
            {[offersMeetup && 'นัดรับ', offersParcel && 'ส่งพัสดุ'].filter(Boolean).join(' · ')}
          </span>
        </div>

        {offersMeetup && shop && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-900">
                <MapPin className="w-4 h-4 text-teal-600" />
                นัดรับ · ฟรีค่าส่ง
              </span>
              <span className="text-[10px] text-teal-700">ดูของก่อนจ่ายเงิน</span>
            </div>
            <ul className="space-y-1.5">
              {shop.meetupPoints.map((point) => (
                <li
                  key={point.id}
                  className="flex items-start gap-2 p-2 rounded-xl bg-white border border-teal-100 text-[11px] text-slate-700"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                  <span className="flex-1">
                    {point.name}
                    <span className="text-slate-400"> · {point.province}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="flex items-center gap-1.5 text-[11px] text-teal-800">
              <CalendarDays className="w-3.5 h-3.5" />
              สะดวกวัน {shop.availableDays.join(' ')} · {shop.availableSlots.join(', ')}
            </p>
          </div>
        )}

        {offersParcel && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Truck className="w-4 h-4 text-slate-500" />
                ส่งพัสดุ
              </span>
              <span className="text-xs font-bold text-slate-800">
                ฿{calcParcelFee(book.isSet ? countSetActualVolumes(book) : 1, shop?.province, shop?.province)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ผู้ขายยืนยันการส่ง · เก็บเงินปลายทาง
              {shop ? ` · ส่งจาก${shop.province}` : ''}
            </p>
            <p className="text-[10px] text-slate-400">
              {book.isSet
                ? `ชุดนี้คิดค่าส่งตามจำนวน ${countSetActualVolumes(book)} เล่ม (฿50 เล่มแรก + ฿10/เล่มถัดไป สูงสุด ฿150)`
                : 'เล่มแรก ฿50 · เล่มถัดไป +฿10/เล่ม สูงสุด ฿150 (รวมในยอดเก็บเงินปลายทาง)'}
            </p>
          </div>
        )}

        {!offersMeetup && !offersParcel && (
          <p className="text-[11px] text-slate-500">ร้านนี้ยังไม่ได้ตั้งค่าการจัดส่ง</p>
        )}

        {shop && !shop.payeeVerified && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ร้านนี้ยังไม่ยืนยันตัวตน · รับได้เฉพาะนัดรับและจ่ายเงินสด
          </div>
        )}
      </div>

      {/* 5-point checklist */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">ผลตรวจสภาพ 5 จุดโดยผู้ขาย</h2>
          <span className="text-xs text-[var(--color-primary-dark)] font-semibold">
            เกรด {book.grade}
          </span>
        </div>
        <ConditionChecklist value={book.checklist} readOnly />
      </div>

      {/* Defects */}
      {book.defects && book.defects.length > 0 && (
        <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wider inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              จุดตำหนิที่ผู้ขายแจ้งไว้ ({book.defects.length} จุด)
            </h2>
            <span className="text-[10px] font-semibold text-amber-700 inline-flex items-center gap-1">
              <ZoomIn className="w-3 h-3" /> แตะที่รายการเพื่อซูมดูภาพ
            </span>
          </div>
          {book.defects.map((defect, idx) => {
            const galleryIdx = defectStartIndex + idx;
            return (
              <button
                key={`${defect.label}-${idx}`}
                type="button"
                onClick={() => {
                  setActivePhotoIdx(galleryIdx);
                  setIsGalleryOpen(true);
                }}
                className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition group"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-amber-200">
                  <img
                    src={defect.photo}
                    alt={defect.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <span className="absolute bottom-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white">
                    <ZoomIn className="w-2.5 h-2.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-950 leading-snug">
                    {defect.label}
                  </p>
                  <p className="text-[10px] text-amber-700 mt-0.5 inline-flex items-center gap-1 font-medium">
                    แตะเพื่อเปิดรูปตำหนิและซูมดูรายละเอียด
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* ISBN Smart Compare */}
      {compareData && !compareData.isSyntheticIsbn && (
        <div id="isbn-compare" className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4 text-[var(--color-primary)]" />
                {book.isSet ? 'เทียบกับชุดอื่น (ISBN เดียวกัน)' : 'เทียบกับร้านอื่น (ISBN เดียวกัน)'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ISBN {compareData.isbn}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
              {compareData.totalOffers > 0
                ? `อีก ${compareData.totalOffers} ตัวเลือก`
                : book.isSet
                  ? 'มีเฉพาะชุดนี้'
                  : 'มีเฉพาะเล่มนี้'}
            </span>
          </div>

          {compareData.offers.length > 0 ? (
            <>
              {/* Current book competitiveness banner */}
              <div
                className={`p-2.5 rounded-xl border text-[11px] font-semibold flex items-center gap-2 ${
                  compareData.cheapestOfferPrice !== null &&
                  compareData.cheapestOfferPrice < book.price
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {compareData.cheapestOfferPrice !== null &&
                  compareData.cheapestOfferPrice < book.price
                    ? `มีร้านอื่นขายเล่มนี้ถูกกว่า ฿${(book.price - compareData.cheapestOfferPrice).toLocaleString()} (เริ่ม ฿${compareData.cheapestOfferPrice.toLocaleString()})`
                    : 'เล่มนี้ราคาต่ำที่สุดสำหรับ ISBN นี้ในขณะนี้'}
                  {compareData.isCurrentBestGrade ? ' · สภาพเกรดสูงสุดที่มีอยู่' : ''}
                </span>
              </div>

              {/* Sort Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {(
                  [
                    { key: 'PRICE', label: 'ราคาต่ำสุด' },
                    { key: 'GRADE', label: 'สภาพดีสุด' },
                    { key: 'PICKUP', label: 'นัดรับ ฿0 ก่อน' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setCompareSort(opt.key)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition shrink-0 ${
                      compareSort === opt.key
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Sorted Offers */}
              <div className="space-y-2">
                {[...compareData.offers]
                  .sort((a, b) => {
                    if (compareSort === 'GRADE') {
                      const rankDiff =
                        (COMPARE_GRADE_RANK[b.grade] ?? 0) -
                        (COMPARE_GRADE_RANK[a.grade] ?? 0);
                      return rankDiff !== 0 ? rankDiff : a.price - b.price;
                    }
                    if (compareSort === 'PICKUP') {
                      if (a.allowPickup !== b.allowPickup) {
                        return a.allowPickup ? -1 : 1;
                      }
                      return a.price - b.price;
                    }
                    return a.price - b.price;
                  })
                  .map((offer) => {
                    const uiGrade = toUiBookGrade(offer.grade);
                    const shopLabel =
                      offer.seller.shopName || offer.seller.nickname || 'ร้านค้ากองดอง';

                    return (
                      <Link
                        key={offer.id}
                        href={`/book/${offer.id}`}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 transition"
                      >
                        {offer.coverImageUrl ? (
                          <img
                            src={offer.coverImageUrl}
                            alt={offer.title}
                            className="w-12 h-16 rounded-xl object-cover bg-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-16 rounded-xl bg-slate-200 shrink-0" />
                        )}

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                              {shopLabel}
                            </span>
                            {offer.isSameSeller && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                ร้านเดียวกัน
                              </span>
                            )}
                            {offer.seller.isVerifiedSeller && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                            {offer.isCheapest && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                ถูกที่สุด
                              </span>
                            )}
                            {offer.isSet && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                                ชุด {countSetActualVolumes(offer)} เล่ม
                              </span>
                            )}
                            {offer.isBestGrade && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                                สภาพดีสุด
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            <GradeBadge grade={uiGrade} size="sm" showDescription={false} />
                            <span className="text-slate-500">
                              {offer.defectCount === 0
                                ? 'ไม่มีตำหนิ'
                                : `ตำหนิ ${offer.defectCount} จุด`}
                            </span>
                            {offer.seller.rating > 0 && (
                              <span className="inline-flex items-center text-amber-600 font-semibold">
                                <Star className="w-2.5 h-2.5 fill-amber-400 stroke-amber-400 mr-0.5" />
                                {offer.seller.rating}
                              </span>
                            )}
                            {offer.seller.conditionAccuratePercent !== null && (
                              <span className="text-emerald-700 font-semibold">
                                · ตรงปก {offer.seller.conditionAccuratePercent}%
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
                            {offer.allowPickup && (
                              <span className="inline-flex items-center gap-0.5 text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                <MapPin className="w-2.5 h-2.5" />
                                นัดรับ ฿0
                                {offer.pickupLocationName ? ` · ${offer.pickupLocationName}` : ''}
                              </span>
                            )}
                            {offer.allowDelivery && (
                              <span className="inline-flex items-center gap-0.5 text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                <Truck className="w-2.5 h-2.5" />
                                ส่งพัสดุ
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-sm font-black text-[var(--color-primary)]">
                            ฿{offer.price.toLocaleString()}
                          </div>
                          {offer.priceDiff < 0 ? (
                            <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              ถูกกว่า ฿{Math.abs(offer.priceDiff).toLocaleString()}
                            </span>
                          ) : offer.priceDiff > 0 ? (
                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                              +฿{offer.priceDiff.toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              ราคาเท่ากัน
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
              </div>
            </>
          ) : (
            <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              ยังไม่มีร้านอื่นลงขายหนังสือ ISBN นี้ในขณะนี้ — เล่มนี้เป็นตัวเลือกเดียวที่พร้อมขาย
            </p>
          )}
        </div>
      )}

      {/* Shop */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ข้อมูลร้านค้า
          </h2>
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-rose-500"
          >
            <Flag className="w-3 h-3" />
            รายงานร้านนี้
          </button>
        </div>

        <Link
          href={`/seller/${book.sellerId}`}
          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={book.sellerAvatar || shop?.avatar || photoList[0].src}
              alt={book.sellerName}
              className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate">
                {shop?.shopName || book.sellerName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                <span className="flex items-center text-amber-500 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400 mr-0.5" />
                  {shop?.rating ?? book.sellerRating}
                </span>
                <span>•</span>
                <span>ขายแล้ว {shop?.completedSales ?? 0} ครั้ง</span>
                {shop?.payeeVerified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    ยืนยันตัวตนแล้ว
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">ยังไม่ยืนยันตัวตน</span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </Link>

        {shop?.reviews && shop.reviews.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700">รีวิวจากผู้ซื้อ</span>
              <Link href={`/seller/${book.sellerId}`} className="text-sky-600 font-semibold">
                ดูทั้งหมด
              </Link>
            </div>
            {shop.reviews.slice(0, 2).map((review) => (
              <div key={review.id} className="p-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-800">
                    {review.author}
                  </span>
                  <span className="flex items-center text-amber-500 text-[10px] font-bold">
                    <Star className="w-3 h-3 fill-amber-400 stroke-amber-400 mr-0.5" />
                    {review.rating}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  {review.comment}
                </p>
                {review.gradeMatched && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    สภาพตรงเกรด
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <PhotoGallery
        isOpen={isGalleryOpen}
        photos={photoList}
        initialIndex={activePhotoIdx}
        shopName={shop?.shopName || book.sellerName}
        onClose={() => setIsGalleryOpen(false)}
      />

      {/* Grade criteria (v4 percentages) */}
      <Modal
        isOpen={isGradeModalOpen}
        onClose={() => setIsGradeModalOpen(false)}
        title="เกณฑ์การจัดเกรดหนังสือ 4 ระดับ"
        confirmText="เข้าใจแล้ว"
        onConfirm={() => setIsGradeModalOpen(false)}
      >
        <div className="space-y-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="font-bold text-emerald-800">เหมือนใหม่ (75% ของราคามือหนึ่ง)</div>
            <div className="text-emerald-700 mt-0.5">ไม่มีตำหนิเลยทั้ง 5 จุด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
            <div className="font-bold text-sky-800">สภาพดีมาก (60% ของราคามือหนึ่ง)</div>
            <div className="text-sky-700 mt-0.5">ตำหนิ 1 จุด เล็กน้อย</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="font-bold text-amber-800">อ่านทั่วไป (45% ของราคามือหนึ่ง)</div>
            <div className="text-amber-700 mt-0.5">รอยเปื้อน/รอยเขียน 1 จุด หรือตำหนิ 2 จุด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
            <div className="font-bold text-purple-800">เน้นอ่าน (30% ของราคามือหนึ่ง)</div>
            <div className="text-purple-700 mt-0.5">ตำหนิ 3 จุดขึ้นไป หรือหน้า/สันเสียหาย</div>
          </div>
        </div>
      </Modal>

      <ConfirmSheet
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title="รายงานร้านนี้?"
        description="ใช้เมื่อพบรูปปลอม ราคาผิด หรือข้อความชวนนอกระบบ · แอดมินจะตรวจสอบ"
        confirmLabel="ส่งรายงาน"
        tone="danger"
        onConfirm={() => {
          setIsReportOpen(false);
          setToastMessage('ส่งรายงานร้านให้แอดมินแล้ว');
        }}
      >
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
          <Store className="w-4 h-4 text-slate-400" />
          {shop?.shopName || book.sellerName}
        </div>
      </ConfirmSheet>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 flex items-center gap-2.5 pointer-events-auto safe-area-bottom shadow-lg">
          {isOwnBook ? (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                  นี่คือหนังสือของคุณ
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  ไม่สามารถซื้อหรือใส่ตะกร้ารายการของตัวเองได้
                </p>
              </div>
              <Button
                onClick={() => router.push('/seller')}
                className="shrink-0"
              >
                จัดการรายการขาย
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                fullWidth
                disabled={!isBookAvailable}
                onClick={handleAddToCart}
                className="flex-1"
              >
                {isBookAvailable ? 'ใส่ตะกร้า' : 'ไม่พร้อมขาย'}
              </Button>
              <Button
                fullWidth
                disabled={!isBookAvailable}
                onClick={handleBuyNow}
                className="flex-1"
              >
                {isBookAvailable ? 'ส่งคำขอซื้อ' : 'ถูกจอง/ขายแล้ว'}
              </Button>
            </>
          )}
        </div>
      </div>

      <CartAddedSheet
        state={cartSheet}
        onClose={() => setCartSheet(null)}
        onViewCart={() => {
          setCartSheet(null);
          router.push('/cart');
        }}
      />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
