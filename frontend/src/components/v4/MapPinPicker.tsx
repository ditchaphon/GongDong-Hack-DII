'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { MapPin, Crosshair, ExternalLink, Copy, Check, Loader2 } from 'lucide-react';

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapPinPickerProps {
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
  landmark: string;
  onLandmarkChange: (landmark: string) => void;
  error?: string;
  className?: string;
}

// โหลด Leaflet แบบ Dynamic Client-Side เพื่อป้องกันปัญหา SSR ReferenceError: window is not defined
const LeafletMapInner = dynamic(() => import('./LeafletMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-dark,#8B5E3C)]" />
      <span className="text-xs font-medium">กำลังโหลด OpenStreetMap...</span>
    </div>
  ),
});

const CMU_FALLBACK: MapPoint = { lat: 18.8023, lng: 98.9524 }; // มหาวิทยาลัยเชียงใหม่ (หอสมุดกลาง)

export const MapPinPicker: React.FC<MapPinPickerProps> = ({
  value,
  onChange,
  landmark,
  onLandmarkChange,
  error,
  className,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ดึงตำแหน่ง GPS อัตโนมัติเมื่อเปิดหน้าจอครั้งแรก (หากยังไม่มีการเลือกพิกัดไว้)
  useEffect(() => {
    if (!value) {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            onChange({
              lat: Number(position.coords.latitude.toFixed(6)),
              lng: Number(position.coords.longitude.toFixed(6)),
            });
            setIsLocating(false);
          },
          () => {
            // หากผู้ใช้ไม่อนุญาต หรือขอตำแหน่งไม่สำเร็จ ให้ Fallback ไปที่ มหาวิทยาลัยเชียงใหม่
            onChange(CMU_FALLBACK);
            setIsLocating(false);
          },
          { timeout: 7000, enableHighAccuracy: true }
        );
      } else {
        onChange(CMU_FALLBACK);
      }
    }
  }, []);

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('เบราว์เซอร์นี้ไม่รองรับการขอตำแหน่ง · กรุณาแตะบนแผนที่แทน');
      return;
    }
    setIsLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
        setIsLocating(false);
      },
      () => {
        setLocateError('ขอตำแหน่งไม่สำเร็จ · กรุณาเลื่อนแตะบนแผนที่เพื่อปักหมุดเอง');
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleOpenGoogleMaps = () => {
    if (!value) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${value.lat},${value.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyCoordinates = () => {
    if (!value) return;
    const text = `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={clsx('space-y-3', className)}>
      {/* Header แถบด้านบน */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-bold text-slate-800">จุดนัดรับ (OpenStreetMap)</span>
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={isLocating}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-dark,#8B5E3C)] hover:opacity-80 transition active:scale-95 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5" />
          )}
          <span>{isLocating ? 'กำลังหาตำแหน่ง...' : 'ใช้ตำแหน่งปัจจุบัน'}</span>
        </button>
      </div>

      {/* กรอบแผนที่จริง Leaflet + OpenStreetMap */}
      <div
        className={clsx(
          'relative w-full aspect-[4/3] rounded-2xl overflow-hidden border shadow-inner',
          error ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200'
        )}
      >
        <LeafletMapInner
          value={value}
          onChange={(newPoint) => {
            onChange(newPoint);
            setLocateError(null);
          }}
          error={error}
        />

        {/* แบดจ์แสดงพิกัดที่มุมล่างซ้าย */}
        {value && (
          <div className="absolute left-2.5 bottom-2.5 z-10 bg-white/90 backdrop-blur-md border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-mono text-slate-600 shadow-sm pointer-events-none">
            {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </div>
        )}
      </div>

      {locateError && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-xl">
          {locateError}
        </p>
      )}

      {/* แถบปุ่ม Action ลัด: เปิด Google Maps & คัดลอกพิกัด */}
      {value && (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleOpenGoogleMaps}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition active:scale-95 border border-slate-200 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span>เปิดใน Google Maps</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCoordinates}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition active:scale-95 border border-slate-200 shadow-sm"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกพิกัด'}</span>
          </button>
        </div>
      )}

      {/* ช่องกรอกจุดสังเกต */}
      <div className="flex flex-col gap-1.5 pt-1">
        <label htmlFor="landmark" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
          <span>จุดสังเกตเพิ่มเติม</span>
          <span className="text-[10px] font-normal text-slate-400">เช่น ม้านั่งใต้ต้นไม้, หน้าร้านกาแฟ</span>
        </label>
        <input
          id="landmark"
          type="text"
          value={landmark}
          onChange={(event) => onLandmarkChange(event.target.value)}
          placeholder="เช่น หน้าร้านกาแฟ หอสมุดกลาง มช."
          maxLength={80}
          className={clsx(
            'w-full px-3.5 py-2.5 rounded-xl border text-xs bg-white focus:outline-none focus:ring-2 transition',
            error
              ? 'border-rose-300 focus:ring-rose-200 text-rose-900'
              : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-100 text-slate-900'
          )}
        />
        {error && <span className="text-[11px] text-rose-500">{error}</span>}
      </div>
    </div>
  );
};
