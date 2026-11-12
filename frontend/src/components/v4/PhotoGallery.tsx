'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { X, ChevronLeft, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';

export interface GalleryPhoto {
  src: string;
  label?: string;
  isDefect?: boolean;
}

export interface PhotoGalleryProps {
  isOpen: boolean;
  photos: GalleryPhoto[];
  initialIndex?: number;
  shopName?: string;
  onClose: () => void;
}

/** Full-screen photo gallery with the v4 watermark overlay. */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  shopName = 'กองดอง',
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (isOpen) setIndex(initialIndex);
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setIndex((prev) => Math.min(prev + 1, photos.length - 1));
      if (event.key === 'ArrowLeft') setIndex((prev) => Math.max(prev - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, photos.length]);

  if (!isOpen || photos.length === 0) return null;

  const photo = photos[Math.min(index, photos.length - 1)];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col select-none">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-xs font-medium">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดรูปภาพ"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-2 relative overflow-hidden">
        <img
          src={photo.src}
          alt={photo.label || 'รูปหนังสือ'}
          className="max-h-full max-w-full object-contain"
        />

        {/* Watermark — system added */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-white/80 bg-black/35 backdrop-blur-xs px-2.5 py-1.5 rounded-lg">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {shopName} · ภาพถ่ายจริง
          </span>
          <span>กองดอง</span>
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="รูปก่อนหน้า"
              onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
              className={clsx(
                'absolute left-2 p-2 rounded-full bg-white/10 text-white',
                index === 0 && 'opacity-30 pointer-events-none'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="รูปถัดไป"
              onClick={() => setIndex((prev) => Math.min(prev + 1, photos.length - 1))}
              className={clsx(
                'absolute right-2 p-2 rounded-full bg-white/10 text-white',
                index === photos.length - 1 && 'opacity-30 pointer-events-none'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-6 pt-2 text-center">
        <p className="text-[11px] text-white/90 inline-flex items-center gap-1.5">
          {photo.isDefect && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          {photo.label || 'รูปหนังสือ'}
        </p>
        <div className="flex justify-center gap-1.5 mt-2">
          {photos.map((item, itemIndex) => (
            <button
              key={item.src + itemIndex}
              type="button"
              aria-label={`ดูรูปที่ ${itemIndex + 1}`}
              onClick={() => setIndex(itemIndex)}
              className={clsx(
                'w-8 h-8 rounded-md overflow-hidden border',
                itemIndex === index ? 'border-white' : 'border-transparent opacity-60'
              )}
            >
              <img src={item.src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
