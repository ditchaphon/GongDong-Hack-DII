'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';

export interface GalleryPhoto {
  src: string;
  label?: string;
  note?: string;
  isDefect?: boolean;
}

export interface PhotoGalleryProps {
  isOpen: boolean;
  photos: GalleryPhoto[];
  initialIndex?: number;
  shopName?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/** Full-screen photo gallery with interactive Zoom/Pan & defect highlight. */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  isOpen,
  photos,
  initialIndex = 0,
  shopName = 'กองดอง',
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null
  );
  const pinchDistanceRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const resetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    dragStartRef.current = null;
    pinchDistanceRef.current = null;
  };

  useEffect(() => {
    if (isOpen) {
      setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, photos.length - 1))));
      resetZoom();
    }
  }, [isOpen, initialIndex, photos.length]);

  useEffect(() => {
    resetZoom();
  }, [index]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') {
        setIndex((prev) => Math.min(prev + 1, photos.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        setIndex((prev) => Math.max(prev - 1, 0));
      }
      if (event.key === '+' || event.key === '=') {
        setScale((prev) => Math.min(MAX_SCALE, Number((prev + 0.5).toFixed(1))));
      }
      if (event.key === '-') {
        setScale((prev) => {
          const next = Math.max(MIN_SCALE, Number((prev - 0.5).toFixed(1)));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, photos.length]);

  if (!isOpen || photos.length === 0) return null;

  const safeIndex = Math.min(index, photos.length - 1);
  const photo = photos[safeIndex];

  const handleZoomIn = () => {
    setScale((prev) => Math.min(MAX_SCALE, Number((prev + 0.75).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Number((prev - 0.75).toFixed(2)));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleCycleZoom = () => {
    if (scale === 1) {
      setScale(2);
    } else if (scale < 3) {
      setScale(3);
    } else {
      resetZoom();
    }
  };

  const handleDoubleTapOrClick = () => {
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || scale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistanceRef.current = Math.hypot(dx, dy);
      return;
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        handleDoubleTapOrClick();
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchDistanceRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const ratio = distance / pinchDistanceRef.current;
      pinchDistanceRef.current = distance;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prev * ratio).toFixed(2))));
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
      return;
    }

    if (e.touches.length === 1 && isDragging && dragStartRef.current && scale > 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    dragStartRef.current = null;
    pinchDistanceRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.35 : -0.35;
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((prev + delta).toFixed(2))));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col select-none">
      {/* Top Bar with Zoom Controls */}
      <div className="flex items-center justify-between px-4 py-3 text-white z-20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full">
            {safeIndex + 1} / {photos.length}
          </span>
          {photo.isDefect && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-500/90 text-slate-950 px-2.5 py-0.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" /> จุดตำหนิที่ผู้ขายแจ้ง
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="ซูมออก"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleCycleZoom}
            aria-label="ระดับการซูม"
            className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-xs font-bold min-w-[48px]"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="ซูมเข้า"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {scale > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              aria-label="รีเซ็ตซูม"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดรูปภาพ"
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Zoomable Image Viewport */}
      <div
        className={clsx(
          'flex-1 flex items-center justify-center px-2 relative overflow-hidden touch-none',
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'
        )}
        onDoubleClick={handleDoubleTapOrClick}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <img
          src={photo.src}
          alt={photo.label || 'รูปหนังสือ'}
          draggable={false}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 150ms ease-out',
          }}
          className="max-h-full max-w-full object-contain pointer-events-none select-none"
        />

        {/* Defect Note Callout Overlay */}
        {photo.isDefect && (photo.note || photo.label) && (
          <div className="absolute top-3 left-3 right-3 z-10 flex items-start gap-2 bg-amber-950/90 border border-amber-400/60 text-amber-100 px-3 py-2 rounded-xl backdrop-blur-xs shadow-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-bold text-amber-300">รายละเอียดจุดตำหนิ: </span>
              <span>{photo.note || photo.label}</span>
            </div>
          </div>
        )}

        {/* Watermark — system added */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-white/80 bg-black/45 backdrop-blur-xs px-2.5 py-1.5 rounded-lg pointer-events-none">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            {shopName} · ภาพถ่ายจริง
          </span>
          <span>
            {scale > 1 ? 'ลากเพื่อเลื่อนดูจุดต่างๆ · แตะ 2 ครั้งเพื่อย่อ' : 'แตะ 2 ครั้งหรือถ่างนิ้วเพื่อซูม'}
          </span>
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="รูปก่อนหน้า"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((prev) => Math.max(prev - 1, 0));
              }}
              className={clsx(
                'absolute left-2 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white z-10',
                safeIndex === 0 && 'opacity-30 pointer-events-none'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="รูปถัดไป"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((prev) => Math.min(prev + 1, photos.length - 1));
              }}
              className={clsx(
                'absolute right-2 p-2.5 rounded-full bg-black/50 hover:bg-black/70 text-white z-10',
                safeIndex === photos.length - 1 && 'opacity-30 pointer-events-none'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="px-4 pb-6 pt-2 text-center z-20">
        <p className="text-xs font-semibold text-white/95 inline-flex items-center gap-1.5">
          {photo.isDefect && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          {photo.label || 'รูปหนังสือ'}
        </p>
        <div className="flex justify-center gap-1.5 mt-2 overflow-x-auto py-1">
          {photos.map((item, itemIndex) => (
            <button
              key={item.src + itemIndex}
              type="button"
              aria-label={`ดูรูปที่ ${itemIndex + 1}`}
              onClick={() => setIndex(itemIndex)}
              className={clsx(
                'relative w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition',
                itemIndex === safeIndex
                  ? item.isDefect
                    ? 'border-amber-400 scale-105'
                    : 'border-white scale-105'
                  : 'border-transparent opacity-60 hover:opacity-90'
              )}
            >
              <img src={item.src} alt="" className="w-full h-full object-cover" />
              {item.isDefect && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
