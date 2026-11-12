'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Chip,
  Input,
  SearchBar,
  GradeBadge,
  TrustBadge,
  StatusBadge,
  BookCard,
  OrderCard,
  BottomSheet,
  Modal,
  Toast,
  Stepper,
  Countdown,
  PhotoUploader,
  ConditionChecklist,
  calculateGrade,
  PriceSuggest,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { MOCK_BOOKS } from '@/mocks/books';
import { V4Showcase } from '@/components/v4/V4Showcase';
import { Order, ConditionChecklist as ConditionChecklistType, BookGrade } from '@/types';
import { Sparkles, Mail, Lock, ShoppingBag, HelpCircle } from 'lucide-react';

export default function DesignSystemPage() {
  // Interactive state demos
  const [selectedChip, setSelectedChip] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [currentStep, setCurrentStep] = useState(2);

  // Overlay states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Checklist state
  const [checklist, setChecklist] = useState<ConditionChecklistType>({
    coverIntact: true,
    noHighlight: true,
    noWaterDamage: true,
    pagesComplete: true,
    noYellowing: false, // 1 defect => Grade B
  });
  const currentGrade = calculateGrade(checklist);

  // Photo uploader state
  const [uploadedPhoto, setUploadedPhoto] = useState<string>(
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600'
  );

  // Sample order for demo
  const sampleOrder: Order = {
    id: 'GD-2611-042',
    buyerId: 'usr-buyer-01',
    sellerId: 'seller-01',
    books: [MOCK_BOOKS[0]],
    totalAmount: 190,
    shippingFee: 0,
    deliveryMethod: 'MEETUP',
    meetupDetails: {
      zone: 'หน้าหอสมุดกลาง มช.',
      scheduledAt: '2026-11-13 15:30',
    },
    status: 'PENDING_ACCEPT',
    createdAt: '12 พ.ย. 2569, 10:30',
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-28">
      {/* Top Header */}
      <TopBar
        title="Design System (กองดอง)"
        subtitle="รวม Component & Tokens ทั้งหมด"
        rightAction={
          <Link
            href="/"
            className="text-xs font-semibold text-[#06C755] hover:underline px-2 py-1"
          >
            กลับหน้าแรก
          </Link>
        }
      />

      <div className="p-4 space-y-8 max-w-[430px] mx-auto w-full">
        {/* Intro */}
        <section className="bg-white p-4 rounded-2xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-800">Phase 1: Design System Library</h2>
          <p className="text-xs text-slate-500 mt-1">
            Component ทั้งหมดสร้างตาม Figma Prototype และ Design Tokens ของ GongDong (LINE LIFF Mobile 390px)
          </p>
        </section>

        {/* 1. Color Tokens */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            1. Brand & Grade Tokens
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-[#06C755] text-white rounded-xl font-bold flex justify-between items-center shadow-xs">
              <span>LINE Green</span>
              <span className="font-mono text-[10px] opacity-80">#06C755</span>
            </div>
            <div className="p-3 bg-amber-500 text-white rounded-xl font-bold flex justify-between items-center shadow-xs">
              <span>Warm Amber</span>
              <span className="font-mono text-[10px] opacity-80">#F59E0B</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl font-semibold flex justify-between items-center">
              <span>Grade A (เหมือนใหม่)</span>
              <span className="text-xs">70%</span>
            </div>
            <div className="p-3 bg-sky-50 text-sky-800 border border-sky-300 rounded-xl font-semibold flex justify-between items-center">
              <span>Grade B (สภาพดีมาก)</span>
              <span className="text-xs">60%</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl font-semibold flex justify-between items-center">
              <span>Grade C (อ่านทั่วไป)</span>
              <span className="text-xs">45%</span>
            </div>
            <div className="p-3 bg-purple-50 text-purple-800 border border-purple-300 rounded-xl font-semibold flex justify-between items-center">
              <span>Grade D (เน้นอ่าน)</span>
              <span className="text-xs">30%</span>
            </div>
          </div>
        </section>

        {/* 2. Buttons */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            2. Buttons (ปุ่ม)
          </h3>
          <div className="space-y-2">
            <Button fullWidth leftIcon={<ShoppingBag className="w-4 h-4" />}>
              Primary Button (ปุ่มหลัก)
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="danger">Danger</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button isLoading>กำลังโหลด</Button>
              <Button disabled>ปิดใช้งาน</Button>
            </div>
          </div>
        </section>

        {/* 3. Chips & Filters */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            3. Chips / Filter Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            <Chip
              label="ทั้งหมด"
              selected={selectedChip === 'all'}
              count={24}
              onClick={() => setSelectedChip('all')}
            />
            <Chip
              label="นัดรับ มช."
              selected={selectedChip === 'meetup'}
              count={12}
              onClick={() => setSelectedChip('meetup')}
            />
            <Chip
              label="นิยาย"
              selected={selectedChip === 'novel'}
              onClick={() => setSelectedChip('novel')}
            />
            <Chip
              label="การ์ตูนยกชุด"
              selected={selectedChip === 'manga'}
              onClick={() => setSelectedChip('manga')}
            />
            <Chip label="ปิดใช้งาน" disabled />
          </div>
        </section>

        {/* 4. Form Inputs & SearchBar */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            4. Inputs & SearchBar
          </h3>
          <div className="space-y-3">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              onSearch={(q) => setToastMessage(`กำลังค้นหา: ${q}`)}
            />
            <Input
              label="ชื่อร้าน"
              placeholder="เช่น ป้าหนอนหนังสือ"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              helperText="ชื่อร้านจะแสดงให้ผู้ซื้อเห็น · ห้ามใส่เบอร์โทรหรือไลน์"
            />
            <Input
              label="ข้อมูลผิดพลาด (Error State)"
              value="invalid_isbn"
              readOnly
              error="ไม่พบข้อมูลหนังสือจากเลข ISBN นี้ กรุณากรอกเอง"
            />
            <Input
              label="ช่องที่ปิดใช้งาน (Disabled)"
              value="ข้อมูลถูกล็อค"
              readOnly
              disabled
            />
          </div>
        </section>

        {/* 5. Trust & Status Badges */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            5. Trust & Status Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            <TrustBadge type="payee" />
            <TrustBadge type="nametag" />
            <TrustBadge type="meetup" />
            <TrustBadge type="parcel" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <StatusBadge status="PENDING_ACCEPT" />
            <StatusBadge status="WAITING_PAYMENT" />
            <StatusBadge status="SHIPPED" />
            <StatusBadge status="MEETUP_CONFIRMED" />
            <StatusBadge status="COMPLETED" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <GradeBadge grade="A" />
            <GradeBadge grade="B" />
            <GradeBadge grade="C" />
            <GradeBadge grade="D" />
          </div>
        </section>

        {/* 6. Stepper */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            6. Stepper (ขั้นตอนลงขาย 4 ขั้น)
          </h3>
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <Stepper currentStep={currentStep} onStepClick={setCurrentStep} />
            <p className="text-center text-xs text-slate-400 mt-2">
              (กดที่ตัวเลขเพื่อสลับขั้น: ปัจจุบันขั้นที่ {currentStep})
            </p>
          </div>
        </section>

        {/* 7. Condition Checklist & Price Suggest */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            7. Condition Checklist (เช็กสภาพ 5 จุด)
          </h3>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">เกรดคำนวณอัตโนมัติ:</span>
              <GradeBadge grade={currentGrade} size="lg" />
            </div>
            <ConditionChecklist value={checklist} onChange={setChecklist} />
            <PriceSuggest
              originalPrice={295}
              grade={currentGrade}
              onApplyPrice={(p) => setToastMessage(`ใช้ราคาแนะนำแล้ว: ฿${p}`)}
            />
          </div>
        </section>

        {/* 8. Photo Uploader */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            8. Photo Uploader (รูปถ่าย 4 ด้าน + ป้ายชื่อ)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <PhotoUploader
              label="1. ปกหน้า + ป้ายชื่อ"
              isRequired
              isNameTag
              previewUrl={uploadedPhoto}
              onRemove={() => setUploadedPhoto('')}
              onChange={(url) => setUploadedPhoto(url)}
            />
            <PhotoUploader
              label="2. ปกหลัง"
              isRequired
              description="เห็นสภาพปกหลังชัดเจน"
            />
          </div>
        </section>

        {/* 9. Countdown Timer */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            9. Countdown SLA Timer
          </h3>
          <Countdown
            initialSeconds={48 * 3600}
            label="เวลาที่เหลือสำหรับจัดส่งพัสดุ (48 ชม.):"
          />
        </section>

        {/* 10. Cards */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            10. Cards (การ์ดหนังสือ และ การ์ดออเดอร์)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <BookCard
              book={MOCK_BOOKS[0]}
              onClick={() => setToastMessage('คลิกดูรายละเอียดเล่ม 1')}
            />
            <BookCard
              book={MOCK_BOOKS[1]}
              onClick={() => setToastMessage('คลิกดูรายละเอียดเล่ม 2 (ยกชุด)')}
            />
          </div>
          <div className="pt-2">
            <OrderCard
              order={sampleOrder}
              role="seller"
              onAction={() => setIsModalOpen(true)}
              onClick={() => setToastMessage('คลิกดูรายละเอียดออเดอร์')}
            />
          </div>
        </section>

        {/* 11. Overlays & Dialogs */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            11. Overlays & Dialogs (BottomSheet / Modal / Toast)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSheetOpen(true)}
            >
              เปิด BottomSheet
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(true)}
            >
              เปิดยืนยัน Modal
            </Button>
          </div>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setToastMessage('บันทึกข้อมูลเรียบร้อยแล้ว ✓')}
          >
            แสดง Toast แจ้งเตือน
          </Button>
        </section>

        {/* 12. Empty States & Skeletons */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            12. Empty States & Skeletons
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState
              title="ยังไม่มีหนังสือในตะกร้า"
              description="เริ่มค้นหาหนังสือมือสองสภาพดี หรือดูรายการแนะนำในหน้าแรก"
              actionText="ไปค้นหาหนังสือ"
              onAction={() => setToastMessage('นำทางไปหน้าค้นหา')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Skeleton variant="book-card" />
            <Skeleton variant="book-card" />
          </div>
        </section>
      </div>

      {/* Interactive BottomSheet Demo */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title="เลือกจุดนัดรับ (Zone Picker)"
        footer={
          <Button fullWidth onClick={() => setIsSheetOpen(false)}>
            ยืนยันจุดนัดรับ
          </Button>
        }
      >
        <div className="space-y-2 py-2">
          {['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.', 'หอพักนักศึกษา ชาย/หญิง', 'คณะวิศวกรรมศาสตร์'].map(
            (zone, i) => (
              <label
                key={zone}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="radio"
                  name="zone"
                  defaultChecked={i === 0}
                  className="accent-[#06C755] w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-800">{zone}</span>
              </label>
            )
          )}
        </div>
      </BottomSheet>

      {/* Interactive Modal Demo */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="ยืนยันใช้ 1 เครดิตรับออเดอร์?"
        description="เมื่อกดยืนยัน ระบบจะหัก 1 เครดิตจากบัญชีของคุณ และเปิดแชทในออเดอร์ให้ทั้งสองฝ่าย"
        confirmText="ใช้ 1 เครดิต"
        onConfirm={() => {
          setIsModalOpen(false);
          setToastMessage('รับออเดอร์สำเร็จ! หัก 1 เครดิตแล้ว');
        }}
      />

      {/* Toast Notification */}
      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />

      {/* v4 building blocks (Phase 1) */}
      <div className="px-4 pb-24">
        <V4Showcase />
      </div>

      {/* Bottom Navigation Preview */}
      <BottomTab orderBadge={1} />
    </div>
  );
}

