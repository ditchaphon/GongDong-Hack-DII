'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  GradeBadge,
  TrustBadge,
  ConditionChecklist,
  BottomSheet,
  Modal,
  Toast,
} from '@/components/ui';
import { MOCK_BOOKS } from '@/mocks/books';
import { useCart } from '@/hooks/useCart';
import {
  Share2,
  Heart,
  MapPin,
  Truck,
  Star,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Info,
  Maximize2,
  X,
} from 'lucide-react';

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { addToCart } = useCart();

  const book = MOCK_BOOKS.find((b) => b.id === resolvedParams.id) || MOCK_BOOKS[0];

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const photoList = [
    { url: book.photos.cover, label: 'ปกหน้า + ป้ายชื่อจริง 🏷️' },
    { url: book.photos.back, label: 'ปกหลัง' },
    { url: book.photos.spine, label: 'สันปก' },
    { url: book.photos.nameTag, label: 'ป้ายชื่อคู่หนังสือ' },
  ];

  const handleAddToCart = () => {
    const res = addToCart(book);
    if (res.success) {
      setToastMessage('เพิ่มลงตะกร้าแล้ว 🛒');
    } else {
      setToastMessage(res.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleBuyNow = () => {
    addToCart(book);
    router.push('/cart');
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setToastMessage('คัดลอกลิงก์แล้ว ✓ (TSHARE)');
    } else {
      setToastMessage('คัดลอกลิงก์แล้ว ✓');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      {/* Header */}
      <TopBar
        title="รายละเอียดหนังสือ"
        rightAction={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              aria-label="แชร์"
              className="p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 transition"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {/* Photo Gallery Carousel (B2 / GAL) */}
      <div className="relative w-full aspect-square bg-slate-900 overflow-hidden">
        <img
          src={photoList[activePhotoIdx].url}
          alt={book.title}
          className="w-full h-full object-contain"
        />

        {/* Paper tag badge */}
        <div className="absolute top-3 left-3">
          <TrustBadge type="nametag" />
        </div>

        {/* Maximize zoom button */}
        <button
          type="button"
          onClick={() => setIsGalleryOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-xs hover:bg-black/70 transition"
          aria-label="ดูภาพขนาดใหญ่"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Photo Index Indicator */}
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-full font-mono">
          {activePhotoIdx + 1} / {photoList.length}
        </div>

        {/* Current Photo Label */}
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-full font-medium">
          {photoList[activePhotoIdx].label}
        </div>
      </div>

      {/* Photo Thumbnail Strip */}
      <div className="flex gap-2 p-3 bg-white border-b border-slate-100 overflow-x-auto">
        {photoList.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActivePhotoIdx(idx)}
            className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 ${
              activePhotoIdx === idx ? 'border-[#06C755]' : 'border-transparent opacity-60'
            }`}
          >
            <img src={p.url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Book Metadata Section */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsGradeModalOpen(true)}
            className="cursor-pointer"
          >
            <GradeBadge grade={book.grade} size="lg" />
          </div>
          {book.isSet && (
            <span className="text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
              ยกชุด {book.totalVolumes} เล่ม
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 leading-snug">
          {book.title}
        </h1>

        <div className="text-xs text-slate-500 space-y-0.5">
          <p>ผู้แต่ง: <span className="font-medium text-slate-800">{book.author}</span></p>
          {book.publisher && <p>สำนักพิมพ์: <span className="font-medium text-slate-800">{book.publisher}</span></p>}
          {book.isbn && <p>ISBN: <span className="font-mono text-slate-800">{book.isbn}</span></p>}
        </div>

        {/* Price display */}
        <div className="flex items-baseline gap-2 pt-2 border-t border-slate-50">
          <span className="text-2xl font-black text-[#06C755]">
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
      </div>

      {/* 5-Point Condition Checklist Section */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            ผลตรวจสภาพ 5 จุดโดยผู้ขาย
          </h2>
          <span className="text-xs text-[#06C755] font-semibold">
            เกรด {book.grade}
          </span>
        </div>
        <ConditionChecklist value={book.checklist} readOnly />
      </div>

      {/* Seller Shop Section (B2S) */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          ข้อมูลผู้ขาย
        </h2>
        <Link
          href={`/seller/${book.sellerId}`}
          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-3">
            <img
              src={book.sellerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={book.sellerName}
              className="w-12 h-12 rounded-full object-cover border border-slate-200"
            />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{book.sellerName}</h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span className="flex items-center text-amber-500 font-semibold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400 mr-0.5" />
                  {book.sellerRating}
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-medium">พร้อมเพย์ตรงชื่อ ✓</span>
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </Link>
      </div>

      {/* Delivery Options Info */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          วิธีจัดส่งของเล่มนี้
        </h2>
        <div className="space-y-2 text-xs">
          {book.deliveryMethods.includes('MEETUP') && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">นัดรับใน มช. ฿0 (ดูของก่อนจ่าย)</span>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  โซนที่สะดวก: {book.meetupZones?.join(', ') || 'หน้าหอสมุดกลาง มช.'}
                </p>
              </div>
            </div>
          )}
          {book.deliveryMethods.includes('PARCEL') && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800">
              <Truck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">ส่งพัสดุ (฿{book.parcelShippingFee || 40})</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  จัดส่งภายใน 48 ชม. หลังได้รับสลิปโอนเงิน (สั่งรวมร้านเดียวกันประหยัดค่าส่ง)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Photo Gallery Modal (GAL) */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-4">
          <div className="flex justify-between items-center text-white pt-2">
            <span className="text-sm font-medium">
              {activePhotoIdx + 1} / {photoList.length} — {photoList[activePhotoIdx].label}
            </span>
            <button
              type="button"
              onClick={() => setIsGalleryOpen(false)}
              className="p-2 text-white hover:opacity-75 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <img
              src={photoList[activePhotoIdx].url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex justify-center gap-2 pb-6">
            {photoList.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActivePhotoIdx(i)}
                className={`w-2.5 h-2.5 rounded-full ${activePhotoIdx === i ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Auto-grade Criteria Modal (GRADE) */}
      <Modal
        isOpen={isGradeModalOpen}
        onClose={() => setIsGradeModalOpen(false)}
        title="เกณฑ์การจัดเกรดหนังสือ 4 ระดับ"
        confirmText="เข้าใจแล้ว"
        onConfirm={() => setIsGradeModalOpen(false)}
      >
        <div className="space-y-2.5 text-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="font-bold text-emerald-800">เกรด A: เหมือนใหม่ (70% ของปก)</div>
            <div className="text-emerald-700 mt-0.5">ไม่มีตำหนิเลย สันไม่ยับ กระดาษขาวสะอาด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
            <div className="font-bold text-sky-800">เกรด B: สภาพดีมาก (60% ของปก)</div>
            <div className="text-sky-700 mt-0.5">ตำหนิ 1 จุด เช่น ขอบกระดาษเหลืองเล็กน้อย หรือสันย่นนิดเดียว</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="font-bold text-amber-800">เกรด C: อ่านทั่วไป (45% ของปก)</div>
            <div className="text-amber-700 mt-0.5">มีรอยเปื้อน รอยไฮไลต์ หรือตำหนิ 2 จุด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
            <div className="font-bold text-purple-800">เกรด D: เน้นอ่าน (30% ของปก)</div>
            <div className="text-purple-700 mt-0.5">ตำหนิ 3 จุดขึ้นไป หรือหน้าหลุด/ซ่อมเทป</div>
          </div>
        </div>
      </Modal>

      {/* Fixed Bottom Purchase Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 flex gap-2.5 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            variant="outline"
            fullWidth
            onClick={handleAddToCart}
            className="flex-1"
          >
            ใส่ตะกร้า
          </Button>
          <Button
            fullWidth
            onClick={handleBuyNow}
            className="flex-1"
          >
            ซื้อเลย
          </Button>
        </div>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}

