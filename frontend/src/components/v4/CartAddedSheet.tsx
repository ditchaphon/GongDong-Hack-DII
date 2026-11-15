'use client';

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { Check, ShoppingBag, X, Info } from 'lucide-react';
import { Book } from '@/types';

export type CartAddedState =
  | { kind: 'ADDED'; book: Book; count: number; totalCount?: number; shopCount?: number }
  | { kind: 'DUPLICATE'; book: Book; count: number; totalCount?: number; shopCount?: number };

export interface CartAddedSheetProps {
  state: CartAddedState | null;
  onClose: () => void;
  onViewCart: () => void;
}

/** Friendly result sheet after "ใส่ตะกร้า" — supports multi-seller cart. */
export const CartAddedSheet: React.FC<CartAddedSheetProps> = ({
  state,
  onClose,
  onViewCart,
}) => {
  useEffect(() => {
    if (!state) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onClose]);

  if (!state) return null;

  const ok = state.kind === 'ADDED';
  const title = ok ? 'เพิ่มลงตะกร้าแล้ว' : 'เล่มนี้อยู่ในตะกร้าแล้ว';
  const shopCount = state.shopCount ?? 1;
  const totalCount = state.totalCount ?? state.count;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl px-5 pt-3 pb-5 safe-area-bottom shadow-2xl animate-sheet-up">
        <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-3" />
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute top-3 right-3 p-2 rounded-full text-slate-400 hover:bg-slate-100"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-2">
          <div
            className={clsx(
              'w-14 h-14 rounded-full flex items-center justify-center animate-pop',
              ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            )}
          >
            {ok ? <Check className="w-7 h-7 stroke-[3]" /> : <Info className="w-6 h-6" />}
          </div>
          <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        </div>

        <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <img
            src={state.book.photos.cover}
            alt=""
            className="w-12 h-16 rounded-lg object-cover bg-slate-100 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{state.book.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{state.book.sellerName}</p>
          </div>
          <span className="text-base font-black text-[var(--color-primary)]">
            ฿{state.book.price.toLocaleString()}
          </span>
        </div>

        <p className="mt-2 text-center text-[11px] text-slate-500">
          ในตะกร้ามี {state.count} เล่มจากร้านนี้
          {shopCount > 1 ? ` · รวมทั้งหมด ${totalCount} เล่ม จาก ${shopCount} ร้าน` : ''}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            เลือกหนังสือต่อ
          </button>
          <button
            type="button"
            onClick={onViewCart}
            className="min-h-[48px] rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] inline-flex items-center justify-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" />
            ดูตะกร้า
          </button>
        </div>
      </div>
    </div>
  );
};
