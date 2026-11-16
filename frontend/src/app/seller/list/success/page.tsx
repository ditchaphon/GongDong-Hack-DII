'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Toast, GradeBadge } from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { useLiff } from '@/hooks/useLiff';
import { useSeller } from '@/hooks/useSeller';
import { api } from '@/lib/api';
import { BackendBookDetail, mapBackendBookDetailToBook } from '@/lib/mappers';
import { BookGrade } from '@/types';
import {
  CheckCircle2,
  Share2,
  Store,
  Plus,
  Eye,
  MessageCircle,
} from 'lucide-react';

interface PublishedBookSummary {
  title: string;
  author: string;
  cover: string;
  grade: BookGrade;
  price: number;
}

function SellerListSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdId = searchParams.get('id');
  const { draft, grade, resetDraft } = useListing();
  const { listings } = useSeller();
  const { shareTargetPicker } = useLiff();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [fetchedSummary, setFetchedSummary] = useState<PublishedBookSummary | null>(null);

  const matchedListing = createdId
    ? listings.find((item) => item.id === createdId)
    : undefined;

  useEffect(() => {
    if (!createdId || matchedListing) return;
    let active = true;
    api
      .get<BackendBookDetail>(`/api/books/${encodeURIComponent(createdId)}`)
      .then((detail) => {
        if (!active) return;
        const mapped = mapBackendBookDetailToBook(detail);
        setFetchedSummary({
          title: mapped.title,
          author: mapped.author,
          cover: mapped.photos.cover,
          grade: mapped.grade,
          price: mapped.price,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [createdId, matchedListing]);

  const summary: PublishedBookSummary = matchedListing
    ? {
        title: matchedListing.title,
        author: matchedListing.author,
        cover: matchedListing.photos.cover,
        grade: matchedListing.grade,
        price: matchedListing.price,
      }
    : fetchedSummary ?? {
        title: draft.title || 'หนังสือที่ลงขาย',
        author: draft.author,
        cover: draft.photos.cover,
        grade,
        price: draft.price,
      };

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const bookPath = createdId ? `/book/${createdId}` : '/search';
  const shareUrl =
    liffId && createdId
      ? `https://liff.line.me/${liffId}${bookPath}`
      : typeof window !== 'undefined'
        ? `${window.location.origin}${bookPath}`
        : bookPath;

  const handleShare = async () => {
    const shared = await shareTargetPicker([
      {
        type: 'text',
        text: `หนังสือสภาพดีจากกองดอง: ${summary.title} ราคา ฿${summary.price.toLocaleString()}\n${shareUrl}`,
      },
    ]);
    if (!shared) {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        // clipboard can be blocked inside LINE — still confirm a fallback action
      }
      setToastMessage('คัดลอกลิงก์ประกาศแล้ว');
      return;
    }
    setToastMessage('แชร์ประกาศผ่าน LINE แล้ว');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <div className="bg-white border-b border-slate-100 px-4 pt-10 pb-6 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-[#8B5E3C]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">ลงประกาศขายสำเร็จ!</h1>
        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
          ประกาศของคุณแสดงบนหน้าแรกแล้ว · ลงขายฟรี
          จะใช้เครดิตเมื่อคุณกดรับออเดอร์เท่านั้น
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="w-16 h-22 rounded-xl bg-slate-100 overflow-hidden shrink-0">
              {summary.cover ? (
                <img
                  src={summary.cover}
                  alt={summary.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                  ไม่มีรูป
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                {summary.title}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{summary.author}</p>
              <div className="mt-1.5">
                <GradeBadge grade={summary.grade} size="sm" />
              </div>
              <p className="text-lg font-black text-[#8B5E3C] mt-1">
                ฿{summary.price.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              แสดงบนหน้าแรกแล้ว
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
              แจ้งเตือนเมื่อมีคนขอซื้อ
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            อยากได้ออเดอร์เร็วขึ้น?
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            แชร์ประกาศให้เพื่อนใน LINE ช่วยกันดู
            หนังสือจะถูกกว่าที่อื่นเพราะไม่มีค่ากลาง
          </p>
          <Button
            variant="outline"
            fullWidth
            leftIcon={<Share2 className="w-4 h-4" />}
            onClick={handleShare}
            className="mt-1"
          >
            แชร์ประกาศให้เพื่อน
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg space-y-2">
          <Button
            fullWidth
            size="lg"
            leftIcon={<Store className="w-4 h-4" />}
            onClick={() => {
              resetDraft('SINGLE');
              router.push('/seller');
            }}
          >
            ไปที่ร้านของฉัน
          </Button>
          <Button
            variant="ghost"
            fullWidth
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              resetDraft('SINGLE');
              router.push('/seller/list');
            }}
          >
            ลงขายอีกเล่ม
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

export default function SellerListSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SellerListSuccessContent />
    </Suspense>
  );
}
