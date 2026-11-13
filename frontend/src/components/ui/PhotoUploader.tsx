'use client';

import React, { useRef } from 'react';
import clsx from 'clsx';
import { Camera, X, Check, Image as ImageIcon } from 'lucide-react';

export interface PhotoUploaderProps {
  label: string;
  description?: string;
  isRequired?: boolean;
  isNameTag?: boolean;
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
  previewUrl,
  onChange,
  onRemove,
  error,
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const simulatedUrl = URL.createObjectURL(file);
      onChange?.(simulatedUrl);
    }
  };

  const handleContainerClick = () => {
    if (!previewUrl) {
      fileInputRef.current?.click();
    }
  };

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

      {error && <span className="text-[11px] text-rose-500 font-medium pl-1">{error}</span>}
    </div>
  );
};

