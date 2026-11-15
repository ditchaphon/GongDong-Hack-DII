'use client';

import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, X, Check, Loader2 } from 'lucide-react';
import { uploadImageFile, UploadBucket } from '@/lib/api';

export interface PhotoUploaderProps {
  label: string;
  description?: string;
  isRequired?: boolean;
  isNameTag?: boolean;
  bucket?: UploadBucket;
  previewUrl?: string;
  onChange?: (url: string) => void;
  onRemove?: () => void;
  error?: string;
  className?: string;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  label,
  description,
  isRequired = false,
  isNameTag = false,
  bucket = 'book-listings',
  previewUrl,
  onChange,
  onRemove,
  error,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const uploaded = await uploadImageFile(file, bucket);
      onChange?.(uploaded.url);
    } catch (err: any) {
      setUploadError(err?.message || 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsUploading(false);
    }
  };

  const handleContainerClick = () => {
    if (!previewUrl && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const displayError = error || uploadError;

  return (
    <div className={clsx('flex flex-col gap-1.5 w-full', className)}>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span className="flex items-center gap-1">
          {label}
          {isRequired && <span className="text-rose-500 font-bold">*</span>}
        </span>
        {isNameTag && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
            ต้องมีป้ายชื่อร้าน + วันที่
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        role="button"
        tabIndex={0}
        onClick={handleContainerClick}
        className={clsx(
          'relative w-full aspect-square rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-3 text-center overflow-hidden select-none',
          previewUrl
            ? 'border-solid border-slate-200 bg-slate-900 group'
            : error
            ? 'border-rose-400 bg-rose-50/50 hover:bg-rose-50 cursor-pointer'
            : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-[#8B5E3C] cursor-pointer'
        )}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.();
                }}
                className="p-2 bg-rose-600 text-white rounded-full hover:bg-rose-700 active:scale-95 transition shadow-md"
                aria-label="ลบรูป"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute bottom-1.5 right-1.5 bg-[#8B5E3C] text-white p-1 rounded-full shadow-xs">
              <Check className="w-3.5 h-3.5" />
            </div>
          </>
        ) : isUploading ? (
          <div className="flex flex-col items-center gap-1.5 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#8B5E3C]" />
            <span className="text-xs font-semibold">กำลังอัปโหลดรูป...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-slate-400">
            <div className="p-2.5 bg-white rounded-full shadow-xs border border-slate-200 text-slate-500">
              <Camera className="w-5 h-5 text-slate-600" />
            </div>
            <span className="text-xs font-semibold text-slate-600">กดเพื่อถ่าย/เลือกรูป</span>
            {description && (
              <span className="text-[10px] text-slate-400 leading-tight">{description}</span>
            )}
          </div>
        )}
      </div>

      {displayError && <span className="text-[11px] text-rose-500 font-medium pl-1">{displayError}</span>}
    </div>
  );
};

