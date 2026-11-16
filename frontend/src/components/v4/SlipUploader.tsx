'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, X, Check, Loader2, Lock, AlertCircle } from 'lucide-react';
import { safeDeleteUploadedImage, uploadImageFile } from '@/lib/api';

export interface SlipUploaderProps {
  previewUrl?: string;
  onChange: (uploadedUrl: string) => void;
  onRemove: () => void;
  isUploading?: boolean;
  error?: string;
  amountLabel?: string;
  className?: string;
}

/**
 * Slip upload for order/top-up payment.
 * Compresses the slip image to WebP and uploads to the private `slips` bucket
 * via POST /api/upload, returning a short-lived signed URL.
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const busy = isUploading || uploading;
  const displayError = error || uploadError;

  const handleFile = async (file?: File) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const previousUrl = previewUrl;
      const uploaded = await uploadImageFile(file, 'slips');
      if (previousUrl && previousUrl !== uploaded.url) {
        void safeDeleteUploadedImage(previousUrl);
      }
      onChange(uploaded.url);
    } catch (err: any) {
      setUploadError(err?.message || 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploading(false);
    }
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
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void handleFile(file);
        }}
      />

      {previewUrl ? (
        <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
          <img src={previewUrl} alt="สลิปโอนเงิน" className="w-full max-h-64 object-contain bg-slate-100" />
          <button
            type="button"
            onClick={() => {
              if (previewUrl) {
                void safeDeleteUploadedImage(previewUrl);
              }
              onRemove();
            }}
            aria-label="ลบสลิป"
            className="absolute top-2 right-2 p-2 rounded-full bg-rose-600 text-white shadow"
          >
            <X className="w-4 h-4" />
          </button>
          {!busy && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3" /> แนบแล้ว
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={clsx(
            'w-full aspect-[5/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center transition',
            displayError
              ? 'border-rose-300 bg-rose-50/50'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
          )}
        >
          {busy ? (
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

      {displayError && (
        <p className="flex items-start gap-1 text-[11px] text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {displayError}
        </p>
      )}
    </div>
  );
};
