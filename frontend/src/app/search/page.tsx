'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar, Chip, BookCard, EmptyState, BottomSheet, Button } from '@/components/ui';
import { TopBar } from '@/components/layout/TopBar';
import { MOCK_BOOKS } from '@/mocks/books';
import { Filter, SlidersHorizontal, MapPin } from 'lucide-react';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(3000);
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C' | 'D'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SINGLE' | 'SET'>('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'MEETUP' | 'PARCEL'>('ALL');
  const [isZoneSheetOpen, setIsZoneSheetOpen] = useState(false);
  const [isPriceSheetOpen, setIsPriceSheetOpen] = useState(false);

  const zones = [
    { id: 'all', label: 'ทุกโซน' },
    { id: 'lib', label: 'หน้าหอสมุดกลาง มช.' },
    { id: 'gate', label: 'ประตูหน้า มช.' },
    { id: 'dorm', label: 'หอพักนักศึกษา' },
  ];

  const filteredBooks = MOCK_BOOKS.filter((b) => {
    const q = query.toLowerCase();
    const matchesQuery =
      !query ||
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn?.includes(query) ||
      b.course?.toLowerCase().includes(q);

    const matchesPrice = b.price <= maxPrice;
    const matchesGrade = gradeFilter === 'ALL' || b.grade === gradeFilter;
    const matchesType =
      typeFilter === 'ALL' || (typeFilter === 'SET' ? b.isSet : !b.isSet);
    const matchesDelivery =
      deliveryFilter === 'ALL' || b.deliveryMethods.includes(deliveryFilter);

    const matchesZone =
      selectedZone === 'all' ||
      (b.deliveryMethods.includes('MEETUP') &&
        b.meetupZones?.some((z) => {
          if (selectedZone === 'lib') return z.includes('หอสมุด');
          if (selectedZone === 'gate') return z.includes('ประตูหน้า');
          if (selectedZone === 'dorm') return z.includes('หอพัก');
          return true;
        }));

    return (
      matchesQuery &&
      matchesPrice &&
      matchesGrade &&
      matchesType &&
      matchesDelivery &&
      matchesZone
    );
  });

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
      <TopBar title="ค้นหาหนังสือ" />

      {/* Search Input Bar */}
      <div className="p-4 bg-white border-b border-slate-100 space-y-3">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="ค้นชื่อหนังสือ ผู้แต่ง ISBN หรือรายวิชา..."
          autoFocus
        />

        {/* Filter Trigger Chips */}
        <div className="flex gap-2 items-center overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setIsZoneSheetOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              selectedZone !== 'all'
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {selectedZone === 'all'
                ? 'โซนนัดรับ'
                : zones.find((z) => z.id === selectedZone)?.label}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsPriceSheetOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              maxPrice < 3000
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
            <span>{maxPrice < 3000 ? `ไม่เกิน ฿${maxPrice}` : 'ราคา'}</span>
          </button>

          <select
            aria-label="กรองเกรดสภาพ"
            value={gradeFilter}
            onChange={(event) =>
              setGradeFilter(event.target.value as 'ALL' | 'A' | 'B' | 'C' | 'D')
            }
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">เกรดทั้งหมด</option>
            <option value="A">เกรด A</option>
            <option value="B">เกรด B</option>
            <option value="C">เกรด C</option>
            <option value="D">เกรด D</option>
          </select>

          <Chip
            label="เล่มเดียว"
            size="sm"
            selected={typeFilter === 'SINGLE'}
            onClick={() =>
              setTypeFilter((prev) => (prev === 'SINGLE' ? 'ALL' : 'SINGLE'))
            }
          />
          <Chip
            label="ยกชุด"
            size="sm"
            selected={typeFilter === 'SET'}
            onClick={() => setTypeFilter((prev) => (prev === 'SET' ? 'ALL' : 'SET'))}
          />
          <Chip
            label="นัดรับได้"
            size="sm"
            selected={deliveryFilter === 'MEETUP'}
            onClick={() =>
              setDeliveryFilter((prev) => (prev === 'MEETUP' ? 'ALL' : 'MEETUP'))
            }
          />
          <Chip
            label="ส่งพัสดุ"
            size="sm"
            selected={deliveryFilter === 'PARCEL'}
            onClick={() =>
              setDeliveryFilter((prev) => (prev === 'PARCEL' ? 'ALL' : 'PARCEL'))
            }
          />

          {(selectedZone !== 'all' ||
            maxPrice < 3000 ||
            query ||
            gradeFilter !== 'ALL' ||
            typeFilter !== 'ALL' ||
            deliveryFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedZone('all');
                setMaxPrice(3000);
                setGradeFilter('ALL');
                setTypeFilter('ALL');
                setDeliveryFilter('ALL');
              }}
              className="text-xs text-rose-500 font-semibold px-2 py-1"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="px-4 py-3 flex items-center justify-between text-xs text-slate-500">
        <span>ผลการค้นหา {filteredBooks.length} รายการ</span>
        {query && <span className="font-semibold text-slate-700 truncate max-w-[150px]">"{query}"</span>}
      </div>

      {/* Results Feed */}
      <div className="px-4 space-y-3 flex-1">
        {filteredBooks.length > 0 ? (
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mt-4">
            <EmptyState
              title="ไม่พบหนังสือที่ตรงกับเงื่อนไข"
              description="ลองค้นหาด้วยคำอื่น หรือกด 'ฝากตามหา' เพื่อให้ระบบแจ้งเตือนเมื่อมีคนลงขาย"
              actionText="🔔 ฝากตามหาเล่มนี้ (Wishlist)"
              onAction={() => router.push('/wishlist')}
            />
          </div>
        )}
      </div>

      {/* Zone Picker Sheet (ZONE) */}
      <BottomSheet
        isOpen={isZoneSheetOpen}
        onClose={() => setIsZoneSheetOpen(false)}
        title="เลือกโซนนัดรับใน มช."
      >
        <div className="space-y-2 py-2">
          {zones.map((z) => (
            <label
              key={z.id}
              onClick={() => {
                setSelectedZone(z.id);
                setIsZoneSheetOpen(false);
              }}
              className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <span className="text-sm font-medium text-slate-800">{z.label}</span>
              <input
                type="radio"
                name="search_zone"
                checked={selectedZone === z.id}
                onChange={() => {}}
                className="accent-[#8B5E3C] w-4 h-4"
              />
            </label>
          ))}
        </div>
      </BottomSheet>

      {/* Price Filter Sheet (PRICE) */}
      <BottomSheet
        isOpen={isPriceSheetOpen}
        onClose={() => setIsPriceSheetOpen(false)}
        title="ตัวกรองงบประมาณ"
        footer={
          <Button fullWidth onClick={() => setIsPriceSheetOpen(false)}>
            ใช้ตัวกรองนี้
          </Button>
        }
      >
        <div className="space-y-4 py-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-slate-500">ราคาสูงสุด:</span>
            <span className="text-xl font-bold text-[#8B5E3C]">
              {maxPrice >= 3000 ? 'ไม่จำกัด' : `฿${maxPrice.toLocaleString()}`}
            </span>
          </div>

          <input
            type="range"
            min={50}
            max={3000}
            step={50}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full accent-[#8B5E3C] cursor-pointer"
          />

          <div className="flex justify-between text-xs text-slate-400">
            <span>฿50</span>
            <span>฿1,500</span>
            <span>฿3,000+</span>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

