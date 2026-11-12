'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { MapPin, Crosshair, Info } from 'lucide-react';

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

/** Mock campus map bounds (Chiang Mai University area). */
const BOUNDS = { minLat: 18.788, maxLat: 18.812, minLng: 98.94, maxLng: 98.968 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

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

  const place = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    onChange({
      lat: Number((BOUNDS.maxLat - y * (BOUNDS.maxLat - BOUNDS.minLat)).toFixed(6)),
      lng: Number((BOUNDS.minLng + x * (BOUNDS.maxLng - BOUNDS.minLng)).toFixed(6)),
    });
    setLocateError(null);
  };

  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocateError('เบราว์เซอร์นี้ใช้ตำแหน่งอัตโนมัติไม่ได้ · แตะบนแผนที่แทน');
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
        setLocateError('ขอตำแหน่งไม่สำเร็จ · แตะบนแผนที่เพื่อปักหมุดเอง');
        setIsLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const pinPosition =
    value &&
    ({
      left: `${((value.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100}%`,
      top: `${((BOUNDS.maxLat - value.lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100}%`,
    } as React.CSSProperties);

  return (
    <div className={clsx('space-y-2.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">จุดนัดรับ</span>
        <button
          type="button"
          onClick={useCurrentLocation}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-dark)]"
        >
          <Crosshair className="w-3.5 h-3.5" />
          {isLocating ? 'กำลังหาตำแหน่ง...' : 'ใช้ตำแหน่งปัจจุบัน'}
        </button>
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="แตะเพื่อปักหมุดจุดนัดรับ"
        onClick={place}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onChange({ lat: 18.8023, lng: 98.9524 });
          }
        }}
        className={clsx(
          'relative w-full aspect-[4/3] rounded-2xl overflow-hidden border select-none cursor-crosshair',
          'bg-[linear-gradient(180deg,#eef7f0_0%,#e6f2ea_100%)]',
          error ? 'border-rose-300' : 'border-slate-200'
        )}
      >
        {/* Mock map texture */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute left-[12%] top-[18%] w-[26%] h-[18%] rounded-md bg-emerald-200/60" />
        <div className="absolute right-[18%] top-[34%] w-[22%] h-[24%] rounded-md bg-sky-200/50" />
        <div className="absolute left-[34%] bottom-[14%] w-[30%] h-[16%] rounded-md bg-amber-100/70" />
        <div className="absolute left-0 right-0 top-[52%] h-1.5 bg-white/80" />
        <div className="absolute top-0 bottom-0 left-[46%] w-1.5 bg-white/80" />

        <span className="absolute left-2 top-2 text-[9px] font-semibold text-slate-500 bg-white/85 px-1.5 py-0.5 rounded">
          แผนที่จำลอง
        </span>

        {value && pinPosition && (
          <span
            className="absolute -translate-x-1/2 -translate-y-full drop-shadow"
            style={pinPosition}
          >
            <MapPin className="w-8 h-8 text-rose-500 fill-rose-200" />
          </span>
        )}

        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[11px] text-slate-500 bg-white/90 border border-slate-200 px-2.5 py-1 rounded-full">
              แตะบนแผนที่เพื่อปักหมุด
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="landmark" className="text-xs font-semibold text-slate-700">
          จุดสังเกต
        </label>
        <input
          id="landmark"
          value={landmark}
          onChange={(event) => onLandmarkChange(event.target.value)}
          placeholder="เช่น หน้าหอสมุดกลาง มช. ใต้ต้นไม้ใหญ่"
          className="w-full min-h-[44px] px-3.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
        />
      </div>

      {value && (
        <p className="text-[10px] text-slate-400 font-mono">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}

      {(error || locateError) && (
        <p className="text-[11px] text-rose-600 font-medium">
          {locateError || error}
        </p>
      )}

      <p className="flex items-start gap-1.5 text-[10px] text-slate-400 leading-relaxed">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        ผู้ซื้อจะเห็นหมุดนี้หลังยืนยันนัด · อย่าใส่บ้านเลขที่หรือเบอร์โทรในจุดสังเกต
      </p>
    </div>
  );
};
