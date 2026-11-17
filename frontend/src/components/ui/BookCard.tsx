'use client';

import React from 'react';
import clsx from 'clsx';
import { Book } from '@/types';
import { countSetActualVolumes } from '@/lib/delivery';
import { GradeBadge } from './GradeBadge';
import { MapPin, Truck, Star } from 'lucide-react';

export interface BookCardProps {
  book: Book;
  onClick?: () => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  isOwnBook?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onClick,
  onAddToCart,
  isOwnBook = false,
  layout = 'vertical',
  className,
}) => {
  const hasMeetup = book.deliveryMethods.includes('MEETUP');
  const hasParcel = book.deliveryMethods.includes('PARCEL');
  const actualSetVolumes = book.isSet ? countSetActualVolumes(book) : 1;
  const hasMissingSetVolumes = Boolean(
    book.isSet && book.missingVolumes && book.missingVolumes.length > 0 && book.totalVolumes
  );
  const setBadgeLabel = book.isSet
    ? hasMissingSetVolumes
      ? `ชุด ${actualSetVolumes}/${book.totalVolumes} เล่ม`
      : `ชุด ${actualSetVolumes} เล่ม`
    : '';

  if (layout === 'horizontal') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        className={clsx(
          'flex gap-3 p-3 bg-white border border-slate-200 rounded-2xl cursor-pointer select-none transition-all',
          'hover:border-slate-300 hover:shadow-xs active:scale-[0.99]',
          className
        )}
      >
        <div className="relative w-20 h-28 bg-slate-100 rounded-xl overflow-hidden shrink-0">
          <img
            src={book.photos.cover}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute top-1 left-1">
            <GradeBadge grade={book.grade} size="sm" showDescription={false} />
          </div>
        </div>

        <div className="flex flex-col justify-between flex-1 min-w-0">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-0.5">
              <span className="truncate">{book.sellerName}</span>
              {isOwnBook && (
                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                  ร้านของคุณ
                </span>
              )}
              <span className="flex items-center text-amber-500 font-semibold">
                <Star className="w-3 h-3 fill-amber-400 stroke-amber-400 mr-0.5" />
                {book.sellerRating}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">
              {book.title}
            </h3>
            {book.isSet && (
              <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                {setBadgeLabel}
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between mt-2 pt-1 border-t border-slate-100">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-[#8B5E3C]">
                ฿{book.price.toLocaleString()}
              </span>
              {book.originalPrice && (
                <span className="text-xs text-slate-400 line-through">
                  ฿{book.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              {hasMeetup && (
                <span title="นัดรับ ฿0" className="flex items-center text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  <MapPin className="w-2.5 h-2.5 mr-0.5" /> นัดรับ
                </span>
              )}
              {hasParcel && (
                <span title="ส่งพัสดุ" className="flex items-center text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                  <Truck className="w-2.5 h-2.5 mr-0.5" /> พัสดุ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      className={clsx(
        'group flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden cursor-pointer select-none transition-all',
        'hover:border-slate-300 hover:shadow-sm active:scale-[0.98]',
        className
      )}
    >
      <div className="relative w-full aspect-[3/4] bg-slate-100 overflow-hidden">
        <img
          src={book.photos.cover}
          alt={book.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <GradeBadge grade={book.grade} size="sm" />
          {book.isSet && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded-md shadow-xs">
              {setBadgeLabel}
            </span>
          )}
        </div>
        {isOwnBook && (
          <div className="absolute top-2 right-2 bg-amber-400/95 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-bold shadow-xs">
            ร้านของคุณ
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug group-hover:text-[#6B4628] transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 truncate">{book.author}</p>
        </div>

        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-[#8B5E3C]">
              ฿{book.price.toLocaleString()}
            </span>
            {book.originalPrice && (
              <span className="text-xs text-slate-400 line-through">
                ฿{book.originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            <span className="truncate max-w-[120px]">{book.sellerName}</span>
            <div className="flex items-center gap-1">
              {hasMeetup && <MapPin className="w-3.5 h-3.5 text-teal-600" />}
              {hasParcel && <Truck className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

