'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  BottomSheet,
  Input,
  Stepper,
  Toast,
  EmptyState,
} from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { useSeller } from '@/hooks/useSeller';
import { IsbnScanner } from '@/components/v4';
import { api } from '@/lib/api';
import { mapApiCategoryToThaiCategories } from '@/lib/catalog';
import { getIsbnSourceMeta, getIsbnToneClasses } from '@/lib/isbnSource';
import type { IsbnLookupSource } from '@/types';
import {
  ScanLine,
  BookOpen,
  Layers,
  Plus,
  Minus,
  ShieldAlert,
  ChevronRight,
  Check,
  Info,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface PreviousListingOption {
  id: string;
  isbn: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string | null;
  categories?: string[];
  description?: string | null;
  original_price: number | null;
  selling_price?: number;
  cover_image_url?: string | null;
  seller_name?: string;
}

export default function SellerListStep1Page() {
  const router = useRouter();
  const { isShopSetup } = useSeller();
  const { draft, update, toggleMissingVolume, resetDraft } = useListing();

  const [isManualIsbnOpen, setIsManualIsbnOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isMissingOpen, setIsMissingOpen] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previousListings, setPreviousListings] = useState<PreviousListingOption[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const isSet = draft.mode === 'SET';

  const selectCandidate = (candidate: PreviousListingOption) => {
    setSelectedCandidateId(candidate.id);
    const mappedCategories =
      candidate.categories && candidate.categories.length > 0
        ? candidate.categories
        : mapApiCategoryToThaiCategories(candidate.category);
    update({
      isbn: candidate.isbn || draft.isbn,
      title: candidate.title,
      author: candidate.author || '',
      publisher: candidate.publisher || '',
      categories: mappedCategories,
      originalPrice: candidate.original_price ? Number(candidate.original_price) : 0,
      ...(candidate.description && !draft.description
        ? { description: candidate.description }
        : {}),
    });
    setToastMessage(`เลือกใช้ข้อมูลจาก "${candidate.title}" เรียบร้อย`);
  };

  const applyLookup = async (isbn: string) => {
    const clean = isbn.replace(/[^0-9Xx]/g, '');
    setManualIsbn(clean);
    setLookingUp(true);
    setPreviousListings([]);
    setSelectedCandidateId(null);
    try {
      const res = await api.get<{
        found: boolean;
        isbn: string;
        source?: 'DATABASE' | 'GOOGLE_BOOKS' | 'OPEN_LIBRARY' | null;
        warning_code?: 'GOOGLE_BOOKS_RATE_LIMITED' | 'EXTERNAL_LOOKUP_FAILED' | null;
        warning_message?: string | null;
        title?: string;
        author?: string | null;
        publisher?: string | null;
        category?: string | null;
        cover_url?: string | null;
        original_price?: number | null;
        previous_listings?: PreviousListingOption[];
      }>(`/api/books/isbn/${encodeURIComponent(clean)}`);

      const candidates: PreviousListingOption[] = [];
      if (res.found && res.title) {
        candidates.push({
          id: 'catalog_master',
          isbn: res.isbn || clean,
          title: res.title,
          author: res.author || null,
          publisher: res.publisher || null,
          category: res.category || null,
          categories: mapApiCategoryToThaiCategories(res.category),
          original_price: res.original_price ?? null,
          cover_image_url: res.cover_url || null,
          seller_name:
            res.source === 'GOOGLE_BOOKS'
              ? 'Google Books Catalog'
              : res.source === 'OPEN_LIBRARY'
                ? 'Open Library Catalog'
                : 'แคตตาล็อกกลางในระบบ',
        });
      }

      if (Array.isArray(res.previous_listings)) {
        for (const item of res.previous_listings) {
          if (candidates.length >= 5) break;
          // Avoid exact duplicate of master catalog if no extra seller info
          const isExactSameAsCatalog =
            candidates.length === 1 &&
            candidates[0].id === 'catalog_master' &&
            candidates[0].title === item.title &&
            (candidates[0].author || '') === (item.author || '') &&
            (candidates[0].publisher || '') === (item.publisher || '') &&
            (candidates[0].original_price || 0) === (item.original_price || 0) &&
            !item.selling_price;
          if (!isExactSameAsCatalog) {
            candidates.push(item);
          }
        }
      }

      setPreviousListings(candidates.slice(0, 5));
      if (candidates.length > 0) {
        setSelectedCandidateId(candidates[0].id);
      }

      if (res.found && res.title) {
        const resolvedSource: IsbnLookupSource = res.source || 'DATABASE';
        const fallbackNote =
          resolvedSource === 'OPEN_LIBRARY' && res.warning_code === 'GOOGLE_BOOKS_RATE_LIMITED'
            ? 'Google Books API ถูกจำกัดสิทธิ์ชั่วคราว (HTTP 429) ระบบจึงดึงข้อมูลจาก Open Library ให้แทน'
            : undefined;
        const mappedCategories = mapApiCategoryToThaiCategories(res.category);

        update({
          isbn: res.isbn || clean,
          title: res.title,
          author: res.author || '',
          publisher: res.publisher || '',
          categories: mappedCategories,
          originalPrice: res.original_price ? Number(res.original_price) : 0,
          isbnLookupSource: resolvedSource,
          isbnLookupMessage: fallbackNote,
        });

        const toastBySource: Record<'DATABASE' | 'GOOGLE_BOOKS' | 'OPEN_LIBRARY', string> = {
          DATABASE: `พบข้อมูลใน Database ของเรา (ISBN ${clean})`,
          GOOGLE_BOOKS: `พบข้อมูลใน Google Books API (ISBN ${clean})`,
          OPEN_LIBRARY: `พบข้อมูลจาก Open Library API สำรอง (ISBN ${clean})`,
        };
        setToastMessage(toastBySource[resolvedSource as 'DATABASE' | 'GOOGLE_BOOKS' | 'OPEN_LIBRARY']);
      } else {
        const missSource: IsbnLookupSource =
          res.warning_code === 'GOOGLE_BOOKS_RATE_LIMITED'
            ? 'RATE_LIMITED'
            : res.warning_code === 'EXTERNAL_LOOKUP_FAILED'
              ? 'ERROR'
              : 'NOT_FOUND';

        const missMessage =
          missSource === 'RATE_LIMITED'
            ? 'Google Books API ถูกจำกัดการใช้งานชั่วคราว (HTTP 429) และไม่พบใน Database/Open Library กรุณากดถัดไปเพื่อกรอกข้อมูลเอง'
            : missSource === 'ERROR'
              ? res.warning_message || 'ไม่สามารถเชื่อมต่อบริการค้นหาหนังสือภายนอกได้ชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง'
              : `ไม่พบ ISBN ${clean} ทั้งใน Database และ Google Books / Open Library กรุณากดถัดไปเพื่อกรอกข้อมูลเอง`;

        update({
          isbn: clean,
          title: '',
          author: '',
          publisher: '',
          categories: [],
          description: '',
          originalPrice: 0,
          isbnLookupSource: missSource,
          isbnLookupMessage: missMessage,
        });
        setToastMessage(
          missSource === 'RATE_LIMITED'
            ? 'Google Books API ติด 429 · กดถัดไปเพื่อกรอกข้อมูลเอง'
            : `ไม่พบข้อมูล ISBN ${clean} ใน Database หรือ API · กรอกข้อมูลเองได้`
        );
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      const is429 = errMsg.includes('429');
      const errSource: IsbnLookupSource = is429 ? 'RATE_LIMITED' : 'ERROR';
      update({
        isbn: clean,
        title: '',
        author: '',
        publisher: '',
        categories: [],
        description: '',
        originalPrice: 0,
        isbnLookupSource: errSource,
        isbnLookupMessage:
          errMsg || 'เกิดข้อผิดพลาดระหว่างค้นหา ISBN กรุณากดถัดไปเพื่อกรอกรายละเอียดเอง',
      });
      setToastMessage(
        is429
          ? 'Google Books API ติด 429 · กดถัดไปเพื่อกรอกข้อมูลเอง'
          : `ค้นหา ISBN ${clean} ไม่สำเร็จ · กดถัดไปเพื่อกรอกข้อมูลเอง`
      );
    } finally {
      setLookingUp(false);
    }
  };

  const handleScan = () => {
    setError(null);
    setIsScannerOpen(true);
  };

  const handleSetTotalVolumes = (nextTotal: number) => {
    const clamped = Math.max(2, Math.min(99, nextTotal));
    update({
      totalVolumes: clamped,
      missingVolumes: draft.missingVolumes.filter((v) => v <= clamped),
    });
  };

  const handleNext = () => {
    if (!isShopSetup) {
      setError('ตั้งชื่อร้านก่อนลงขายหนังสือ');
      return;
    }
    router.push('/seller/list/details');
  };

  const handleNoIsbn = () => {
    update({
      isbn: '',
      title: '',
      author: '',
      publisher: '',
      categories: [],
      description: '',
      originalPrice: 0,
      isbnLookupSource: undefined,
      isbnLookupMessage: undefined,
    });
    setIsScannerOpen(false);
    router.push('/seller/list/details');
  };

  if (!isShopSetup) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="ลงขายหนังสือ" />
        <div className="p-4 flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 mt-6">
            <EmptyState
              icon={<ShieldAlert className="w-8 h-8 text-amber-500" />}
              title="ตั้งร้านก่อนลงขาย"
              description="ตั้งชื่อร้านและจุดนัดรับ ใช้เวลาประมาณ 1 นาที · ไม่ต้องใช้ชื่อจริง เบอร์โทร หรือบัญชีธนาคาร"
              actionText="ไปตั้งร้าน"
              onAction={() => router.push('/seller/setup')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ลงขายหนังสือ" onBack={() => router.push('/seller')} />

      <Stepper currentStep={1} />

      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            ลงขายฟรี · ไม่จำกัดจำนวน
          </span>
          <span className="text-slate-400">ใช้ 1 เครดิตเมื่อรับออเดอร์</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Single / Set mode toggle (S2 / S2B) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => resetDraft('SINGLE')}
            className={`p-3 rounded-2xl border text-left transition ${
              !isSet
                ? 'border-[#8B5E3C] bg-emerald-50/60 ring-2 ring-[#8B5E3C]/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <BookOpen
              className={`w-5 h-5 mb-1.5 ${!isSet ? 'text-[#6B4628]' : 'text-slate-400'}`}
            />
            <div className="text-sm font-bold text-slate-800">ขายเล่มเดียว</div>
            <div className="text-[11px] text-slate-500">หนังสือ 1 เล่ม</div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isSet) resetDraft('SET');
            }}
            className={`p-3 rounded-2xl border text-left transition ${
              isSet
                ? 'border-[#8B5E3C] bg-emerald-50/60 ring-2 ring-[#8B5E3C]/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <Layers
              className={`w-5 h-5 mb-1.5 ${isSet ? 'text-[#6B4628]' : 'text-slate-400'}`}
            />
            <div className="text-sm font-bold text-slate-800">ขายยกชุด</div>
            <div className="text-[11px] text-slate-500">หลายเล่มในราคาเดียว</div>
          </button>
        </div>

        {/* Scan card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isSet ? 'ขั้นที่ 1 · สแกนบาร์โค้ดทุกเล่ม' : 'ขั้นที่ 1 · สแกนบาร์โค้ด ISBN'}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleScan}
            className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 flex flex-col items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <ScanLine className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-emerald-800">
              สแกนบาร์โค้ดหลังปก
            </span>
            <span className="text-[11px] text-emerald-700/80">
              เปิดกล้องอ่านบาร์โค้ด · ถ้าสแกนไม่ได้ให้พิมพ์เลขเอง
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => setIsManualIsbnOpen(true)}
            >
              พิมพ์เลข ISBN เอง
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={handleNoIsbn}
            >
              ไม่มี ISBN · กรอกเอง
            </Button>
          </div>
        </div>

        {/* Looking up ISBN indicator */}
        {lookingUp && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-900">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-600" />
            <span>กำลังค้นหาข้อมูลหนังสือจาก Database และ Google Books / Open Library…</span>
          </div>
        )}

        {/* Book found card */}
        {draft.title ? (() => {
          const sourceMeta = getIsbnSourceMeta(draft.isbnLookupSource, draft.isbnLookupMessage);
          const toneClasses = sourceMeta ? getIsbnToneClasses(sourceMeta.tone) : null;
          return (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <Check className="w-4 h-4 stroke-[3]" />
                พบข้อมูลหนังสือแล้ว
              </div>
              {sourceMeta && toneClasses && (
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${toneClasses.badge}`}
                >
                  {sourceMeta.badgeLabel}
                </span>
              )}
            </div>
            {sourceMeta && toneClasses && (
              <p className={`text-[11px] px-2.5 py-1.5 rounded-xl border ${toneClasses.banner}`}>
                {sourceMeta.description}
              </p>
            )}
            <div className="flex gap-3">
              <div className="w-14 h-18 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-300">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                  {draft.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{draft.author}</p>
                <p className="text-[11px] text-slate-400">
                  {draft.publisher} · ISBN {draft.isbn || '-'}
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  ราคามือหนึ่ง ฿{draft.originalPrice.toLocaleString()}
                </p>
              </div>
            </div>
            <Input
              label={isSet ? 'ชื่อชุดหนังสือ (แก้ได้)' : 'ชื่อหนังสือ (แก้ได้)'}
              value={draft.title}
              onChange={(event) => update({ title: event.target.value })}
              helperText="ข้อมูลจาก ISBN ถูกล็อก · แก้ได้เฉพาะชื่อหนังสือ"
            />

            {previousListings.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">
                    หนังสือที่มี ISBN นี้ในระบบ ({previousListings.length} รายการ) · แตะเพื่อเลือกข้อมูล
                  </span>
                </div>
                <div className="space-y-2">
                  {previousListings.slice(0, 5).map((cand, idx) => {
                    const isSelected =
                      selectedCandidateId === cand.id ||
                      (!selectedCandidateId && idx === 0);
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => selectCandidate(cand)}
                        className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 ${
                          isSelected
                            ? 'border-[#8B5E3C] bg-amber-50/50 ring-1 ring-[#8B5E3C]/30'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                        }`}
                      >
                        {cand.cover_image_url ? (
                          <img
                            src={cand.cover_image_url}
                            alt={cand.title}
                            className="w-11 h-14 rounded-lg object-cover bg-slate-200 shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-11 h-14 rounded-lg bg-slate-200/70 shrink-0 flex items-center justify-center text-slate-400">
                            <BookOpen className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-900 line-clamp-1">
                              {cand.title}
                            </p>
                            {isSelected && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-[#6B4628] bg-amber-100 px-1.5 py-0.5 rounded-full">
                                <Check className="w-3 h-3" /> เลือกอยู่
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {cand.author || 'ไม่ระบุผู้แต่ง'}
                            {cand.publisher ? ` · ${cand.publisher}` : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-600">
                            {cand.original_price ? (
                              <span className="font-semibold text-emerald-700">
                                ราคาปก ฿{Number(cand.original_price).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">ไม่ระบุราคาปก</span>
                            )}
                            {cand.selling_price ? (
                              <span>
                                · เคยลงขาย ฿{Number(cand.selling_price).toLocaleString()}
                              </span>
                            ) : null}
                            {cand.seller_name ? (
                              <span className="text-slate-400 truncate">
                                ({cand.seller_name})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setPreviousListings([]);
                setSelectedCandidateId(null);
                update({
                  title: '',
                  author: '',
                  publisher: '',
                  isbn: '',
                  categories: [],
                  description: '',
                  originalPrice: 0,
                  isbnLookupSource: undefined,
                  isbnLookupMessage: undefined,
                });
              }}
              className="text-[11px] text-slate-400 hover:text-rose-500 transition"
            >
              ลบข้อมูลนี้และสแกนใหม่
            </button>
          </div>
          );
        })() : draft.isbn && draft.isbnLookupSource ? (() => {
          const missMeta = getIsbnSourceMeta(draft.isbnLookupSource, draft.isbnLookupMessage);
          const toneClasses = missMeta ? getIsbnToneClasses(missMeta.tone) : getIsbnToneClasses('amber');
          return (
          <div className={`rounded-2xl border p-4 space-y-2.5 ${toneClasses.banner}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold leading-snug">
                    {missMeta?.title || `ไม่พบข้อมูล ISBN ${draft.isbn}`}
                  </p>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-90">
                    {missMeta?.description}
                  </p>
                </div>
              </div>
              {missMeta && (
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneClasses.badge}`}>
                  ISBN {draft.isbn}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() =>
                  update({
                    isbn: '',
                    isbnLookupSource: undefined,
                    isbnLookupMessage: undefined,
                  })
                }
                className="text-[11px] underline opacity-80 hover:opacity-100"
              >
                สแกนหรือกรอก ISBN ใหม่
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-current/20 transition"
              >
                กรอกรายละเอียดเอง →
              </button>
            </div>
          </div>
          );
        })() : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              ระบบจะดึงชื่อหนังสือ ผู้แต่ง สำนักพิมพ์ และราคามือหนึ่งให้อัตโนมัติเมื่อสแกน ISBN
              · หลังพบข้อมูลแล้ว ช่องเหล่านั้นจะถูกล็อก แก้ได้เฉพาะชื่อหนังสือ
            </span>
          </div>
        )}

        {/* Set volumes configuration */}
        {isSet && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                รายละเอียดชุดหนังสือ
              </h3>
              <button
                type="button"
                onClick={() => setIsMissingOpen(true)}
                className="text-[11px] font-semibold text-sky-600 hover:underline"
              >
                แจ้งเล่มที่ขาดหาย
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="text-xs font-bold text-slate-800">จำนวนเล่มทั้งหมดในชุด</div>
                <div className="text-[11px] text-slate-500">ระบุจำนวนเล่มเต็มของซีรีส์หรือชุดนี้</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="ลดจำนวนเล่ม"
                  disabled={draft.totalVolumes <= 2}
                  onClick={() => handleSetTotalVolumes(draft.totalVolumes - 1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700 disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-black text-slate-900">
                  {draft.totalVolumes}
                </span>
                <button
                  type="button"
                  aria-label="เพิ่มจำนวนเล่ม"
                  onClick={() => handleSetTotalVolumes(draft.totalVolumes + 1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {draft.missingVolumes.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                แจ้งไว้แล้วว่าขาดเล่ม: {draft.missingVolumes.join(', ')}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ถัดไป · รายละเอียดหนังสือ
          </Button>
        </div>
      </div>

      {/* Type ISBN manually */}
      <BottomSheet
        isOpen={isManualIsbnOpen}
        onClose={() => setIsManualIsbnOpen(false)}
        title="พิมพ์เลข ISBN เอง"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={manualIsbn.replace(/[^0-9Xx]/g, '').length < 10}
            onClick={() => {
              applyLookup(manualIsbn.replace(/[^0-9Xx]/g, '').toUpperCase());
              setIsManualIsbnOpen(false);
              setManualIsbn('');
            }}
          >
            ค้นหาหนังสือ
          </Button>
        }
      >
        <div className="space-y-3 py-1">
          <Input
            label="เลข ISBN (10 หรือ 13 หลัก)"
            placeholder="เช่น 9786160838257 หรือ 014044913X"
            inputMode="text"
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
            helperText="ดูเลข ISBN ได้ที่ด้านหลังปก ใต้บาร์โค้ด"
          />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ใช้ปุ่มสแกนบาร์โค้ดก่อน ถ้ากล้องอ่านไม่ชัดจึงพิมพ์เลขเอง
          </p>
        </div>
      </BottomSheet>

      {/* Mark missing volumes */}
      <BottomSheet
        isOpen={isMissingOpen}
        onClose={() => setIsMissingOpen(false)}
        title="แจ้งเล่มที่ขาดหาย"
        footer={
          <Button fullWidth size="lg" onClick={() => setIsMissingOpen(false)}>
            บันทึกเล่มที่ขาด
          </Button>
        }
      >
        <div className="space-y-2 py-1">
          <p className="text-xs text-slate-500 leading-relaxed pb-2">
            เลือกเล่มที่ไม่มีในชุด ระบบจะแสดงข้อมูลนี้บนหน้าประกาศขาย
            เพื่อให้ผู้ซื้อตัดสินใจได้ถูกต้อง
          </p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: draft.totalVolumes }, (_, i) => i + 1).map((vol) => {
              const selected = draft.missingVolumes.includes(vol);
              return (
                <button
                  key={vol}
                  type="button"
                  onClick={() => toggleMissingVolume(vol)}
                  className={`h-11 rounded-xl border text-sm font-bold transition ${
                    selected
                      ? 'bg-rose-500 border-rose-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {vol}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>

      <IsbnScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(isbn) => {
          setIsScannerOpen(false);
          applyLookup(isbn);
        }}
        onManual={() => {
          setIsScannerOpen(false);
          setIsManualIsbnOpen(true);
        }}
        onNoIsbn={handleNoIsbn}
      />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
