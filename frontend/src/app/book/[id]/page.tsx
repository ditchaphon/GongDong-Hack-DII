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
  Modal,
  Toast,
} from '@/components/ui';
import { PhotoGallery, ConfirmSheet } from '@/components/v4';
import { MOCK_BOOKS } from '@/mocks/books';
import { getShopById } from '@/mocks/shops';
import { useCart } from '@/hooks/useCart';
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
  const shop = getShopById(book.sellerId);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const photoList = [
    { src: book.photos.cover, label: 'ปกหน้า + ป้ายชื่อร้าน' },
    { src: book.photos.back, label: 'ปกหลัง' },
    { src: book.photos.spine, label: 'สันหนังสือ' },
    { src: book.photos.nameTag, label: 'ป้ายชื่อร้าน + วันที่' },
    ...(book.defects || []).map((defect) => ({
      src: defect.photo,
      label: defect.label,
      isDefect: true,
    })),
  ];

  const handleAddToCart = () => {
    const res = addToCart(book);
    setToastMessage(res.success ? 'เพิ่มลงตะกร้าแล้ว' : res.message || 'เกิดข้อผิดพลาด');
  };

  const handleBuyNow = () => {
    addToCart(book);
    router.push('/cart');
  };

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

      {/* Photo gallery (watermarked, v4) */}
      <div className="relative w-full aspect-square bg-slate-900 overflow-hidden">
        <img
          src={photoList[activePhotoIdx].src}
          alt={book.title}
          className="w-full h-full object-contain"
        />

        <div className="absolute top-3 left-3">
          <TrustBadge type="nametag" label="ป้ายชื่อร้าน + วันที่" />
        </div>

        <button
          type="button"
          onClick={() => setIsGalleryOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-xs hover:bg-black/70 transition"
          aria-label="ดูภาพขนาดใหญ่"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded-full font-mono">
          {activePhotoIdx + 1} / {photoList.length}
        </div>

        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-full font-medium max-w-[60%] truncate">
          {photoList[activePhotoIdx].label}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="flex gap-2 p-3 bg-white border-b border-slate-100 overflow-x-auto">
        {photoList.map((photo, index) => (
          <button
            key={`${photo.src}-${index}`}
            type="button"
            onClick={() => setActivePhotoIdx(index)}
            aria-label={`ดูรูปที่ ${index + 1}`}
            className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition shrink-0 ${
              activePhotoIdx === index
                ? 'border-[var(--color-primary)]'
                : 'border-transparent opacity-60'
            }`}
          >
            <img src={photo.src} alt="" className="w-full h-full object-cover" />
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
              ยกชุด {book.totalVolumes} เล่ม
            </span>
          )}
        </div>

        <h1 className="text-xl font-bold text-slate-900 leading-snug">{book.title}</h1>

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

        <div className="flex items-baseline gap-2 pt-2 border-t border-slate-50">
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
        <p className="text-[10px] text-slate-400">
          ราคาปก {book.originalPrice ? `฿${book.originalPrice.toLocaleString()}` : 'ไม่ระบุ'} ·
          เทียบกับร้านอื่นได้จากหน้าแรก
        </p>
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            ตำหนิที่แจ้งไว้
          </h2>
          {book.defects.map((defect) => (
            <div
              key={defect.label}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-200 bg-amber-50/60"
            >
              <img
                src={defect.photo}
                alt={defect.label}
                className="w-12 h-12 rounded-lg object-cover bg-slate-100"
              />
              <span className="text-[11px] text-amber-900 leading-relaxed">{defect.label}</span>
            </div>
          ))}
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
                    ยืนยันบัญชีรับเงิน
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">ยังไม่ยืนยันบัญชี</span>
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

      {/* Delivery */}
      <div className="mt-2 p-4 bg-white border-y border-slate-100 space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          วิธีรับหนังสือ
        </h2>
        <div className="space-y-2 text-xs">
          {book.deliveryMethods.includes('MEETUP') && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">นัดรับฟรี ฿0 (ดูของก่อนจ่าย)</span>
                <p className="text-[11px] text-teal-700 mt-0.5">
                  ผู้ขายจะเสนอบลาและหมุดจุดนัดในแชทออเดอร์ · ผู้ซื้อเป็นคนยืนยันนัด
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
                  +฿10 ต่อเล่มถัดไปในร้านเดียวกัน · ผู้ขายส่งภายใน 48 ชม. หลังตรวจสลิปผ่าน
                </p>
              </div>
            </div>
          )}
          {shop && !shop.payeeVerified && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ร้านนี้ยังไม่ยืนยันบัญชีรับเงิน · รับได้เฉพาะนัดรับและจ่ายเงินสด
            </div>
          )}
        </div>
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
            <div className="font-bold text-emerald-800">เหมือนใหม่ (75% ของราคาปก)</div>
            <div className="text-emerald-700 mt-0.5">ไม่มีตำหนิเลยทั้ง 5 จุด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200">
            <div className="font-bold text-sky-800">สภาพดีมาก (60% ของราคาปก)</div>
            <div className="text-sky-700 mt-0.5">ตำหนิ 1 จุด เล็กน้อย</div>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
            <div className="font-bold text-amber-800">อ่านทั่วไป (45% ของราคาปก)</div>
            <div className="text-amber-700 mt-0.5">รอยเปื้อน/รอยเขียน 1 จุด หรือตำหนิ 2 จุด</div>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
            <div className="font-bold text-purple-800">เน้นอ่าน (30% ของราคาปก)</div>
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
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 flex gap-2.5 pointer-events-auto safe-area-bottom shadow-lg">
          <Button variant="outline" fullWidth onClick={handleAddToCart} className="flex-1">
            ใส่ตะกร้า
          </Button>
          <Button fullWidth onClick={handleBuyNow} className="flex-1">
            ส่งคำขอซื้อ
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
