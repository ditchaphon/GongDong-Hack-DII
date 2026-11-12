'use client';

import React, { useRef } from 'react';
import clsx from 'clsx';
import { Camera, X, Check, Loader2, Lock, AlertCircle } from 'lucide-react';

export interface SlipUploaderProps {
  previewUrl?: string;
  onChange: (previewUrl: string) => void;
  onRemove: () => void;
  isUploading?: boolean;
  error?: string;
  amountLabel?: string;
  className?: string;
}

/**
 * Slip upload for order/top-up payment.
 * The preview is a local object URL only — real slips live in a private bucket
 * and are shown through short-lived signed URLs (v4 storage rule).
 */
export const SlipUploader: React.FC<SlipUploaderProps> = ({
  previewUrl,
  onChange,
  onRemove,
  isUploading = false,
  error,
  amountLabel,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file?: File) => {
    if (!file) return;
    onChange(URL.createObjectURL(file));
  };

  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">
          สลิปโอนเงิน <span className="text-rose-500">*</span>
        </span>
        {amountLabel && (
          <span className="text-[11px] text-slate-500">ยอด {amountLabel}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {previewUrl ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
          <img src={previewUrl} alt="สลิปโอนเงิน" className="w-full max-h-64 object-contain bg-slate-100" />
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบสลิป"
            className="absolute top-2 right-2 p-2 rounded-full bg-rose-600 text-white shadow"
          >
            <X className="w-4 h-4" />
          </button>
          {!isUploading && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> แนบแล้ว
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={clsx(
            'w-full aspect-[5/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center transition',
            error
              ? 'border-rose-300 bg-rose-50/50'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              <span className="text-xs text-slate-500">กำลังอัปโหลด...</span>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-600">แนบสลิปโอนเงิน</span>
              <span className="text-[10px] text-slate-400">
                ต้องเห็นยอดเงิน วันเวลา และเลขที่รายการ
              </span>
            </>
          )}
        </button>
      )}

      <p className="flex items-center gap-1 text-[10px] text-slate-400">
        <Lock className="w-3 h-3" />
        สลิปถูกเก็บแบบส่วนตัว · ผู้ซื้อและผู้ขายเห็นได้เฉพาะในออเดอร์นี้
      </p>

      {error && (
        <p className="flex items-start gap-1 text-[11px] text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
};
