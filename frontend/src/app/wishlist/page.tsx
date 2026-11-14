'use client';

import React, { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import { Button, Input, BottomSheet, Toast, EmptyState } from '@/components/ui';
import { Bell, Plus, Trash2, Sparkles, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface WishlistItem {
  id: string;
  title: string;
  maxPrice: number;
  meetupZone?: string;
  createdAt: string;
  matchCount: number;
}

const WISHLIST_STORAGE_KEY = 'gongdong.wishlist.v1';

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('200');
  const [newZone, setNewZone] = useState('หน้าหอสมุดกลาง มช.');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items, hydrated]);

  const handleAddWishlist = () => {
    if (!newTitle.trim()) return;

    const newItem: WishlistItem = {
      id: `wish-${Date.now()}`,
      title: newTitle,
      maxPrice: Number(newMaxPrice) || 200,
      meetupZone: newZone,
      createdAt: 'วันนี้',
      matchCount: 0,
    };

    setItems((prev) => [newItem, ...prev]);
    setIsAddSheetOpen(false);
    setNewTitle('');
    setToastMessage('บันทึกรายการตามหาไว้บนอุปกรณ์นี้แล้ว (ระบบแจ้งเตือน LINE กำลังพัฒนา)');
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setToastMessage('ลบรายการตามหาเรียบร้อยแล้ว');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-20">
      <TopBar
        title="ฝากตามหาหนังสือ"
        showBack={false}
        rightAction={
          <button
            type="button"
            onClick={() => setIsAddSheetOpen(true)}
            aria-label="เพิ่มรายการตามหา"
            className="flex items-center gap-1 text-xs font-bold text-[#8B5E3C] px-2 py-1 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
          >
            <Plus className="w-4 h-4" />
            <span>ตามหาเล่มใหม่</span>
          </button>
        }
      />

      {/* Info Hero Banner */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Bell className="w-4 h-4 text-[#8B5E3C]" />
          <span>รายการหนังสือที่อยากได้ (ระบบแจ้งเตือน LINE กำลังพัฒนา)</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          บันทึกชื่อหนังสือและงบประมาณที่ต้องการไว้บนอุปกรณ์นี้ก่อนได้ ฟีเจอร์ส่งข้อความแจ้งเตือนอัตโนมัติผ่าน LINE กำลังอยู่ในระหว่างการพัฒนา
        </p>
      </div>

      {/* Wishlist Items Feed */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex justify-between items-center text-xs text-slate-500">
          <span>รายการที่คุณกำลังตามหา ({items.length} เล่ม)</span>
        </div>

        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">
                    {item.title}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 space-x-2">
                    <span>งบไม่เกิน: <strong className="text-[#8B5E3C]">฿{item.maxPrice}</strong></span>
                    {item.meetupZone && (
                      <span>• นัดรับ: <strong>{item.meetupZone}</strong></span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  aria-label="ลบรายการ"
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Match status */}
              {item.matchCount > 0 ? (
                <Link
                  href="/search?q=เจ้าชายน้อย"
                  className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#8B5E3C]" />
                    พบหนังสือที่ตรงกับเงื่อนไข {item.matchCount} เล่ม!
                  </span>
                  <span className="text-[#8B5E3C]">ดูรายการ →</span>
                </Link>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                  <span>บันทึกไว้บนอุปกรณ์นี้ · แจ้งเตือน LINE กำลังพัฒนา</span>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
            <EmptyState
              icon={<BookOpen className="w-8 h-8 text-slate-400" />}
              title="ยังไม่มีรายการฝากตามหา"
              description="ระบุหนังสือที่คุณอยากได้ไว้เลย เมื่อมีคนลงขายระบบจะแจ้งเตือนคุณทันที"
              actionText="+ ฝากตามหาหนังสือ"
              onAction={() => setIsAddSheetOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Add Wishlist BottomSheet (B4 / WMANAGE) */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="ฝากตามหาหนังสือใหม่ (B4)"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!newTitle.trim()}
            onClick={handleAddWishlist}
          >
            บันทึกการฝากตามหา
          </Button>
        }
      >
        <div className="space-y-3.5 py-2">
          <Input
            label="ชื่อหนังสือ หรือเลข ISBN *"
            placeholder="เช่น Atomic Habits, โต๊ะโตะจัง, หรือ 978616..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />

          <Input
            label="งบประมาณสูงสุดที่คุณยินดีจ่าย (บาท)"
            placeholder="เช่น 150"
            type="number"
            value={newMaxPrice}
            onChange={(e) => setNewMaxPrice(e.target.value)}
          />

          <Input
            label="โซนนัดรับที่สะดวก (ถ้าต้องการ)"
            placeholder="เช่น หน้าหอสมุดกลาง มช., สุเทพ"
            value={newZone}
            onChange={(e) => setNewZone(e.target.value)}
          />

          <p className="text-[11px] text-slate-400 pt-1">
            * ระบบจะจับคู่จากชื่อหนังสือและราคา หากมีคนลงขาย จะแจ้งเตือนในแชทบอท LINE ทันที
          </p>
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />

      <BottomTab orderBadge={1} />
    </div>
  );
}

