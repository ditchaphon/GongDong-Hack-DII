'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, X, RefreshCcw, ScanLine, Loader2, CameraOff, ImageIcon } from 'lucide-react';
import { uploadImageFile, UploadBucket } from '@/lib/api';
import {
  compressImageToDataUrl,
  prepareImageForPreviewAndUpload,
} from '@/lib/imageCompression';

export interface CameraCaptureProps {
  isOpen: boolean;
  /** PHOTO = take a picture or pick from the gallery; SCAN = read a buyer's QR. */
  mode: 'PHOTO' | 'SCAN';
  title: string;
  hint?: string;
  onClose: () => void;
  onCapture?: (dataUrl: string) => void;
  onScan?: () => void;
  /** Used when the device has no camera (prototype only). */
  demoImage?: string;
  /** Supabase Storage bucket for uploaded photos (defaults to 'book-listings'). */
  bucket?: UploadBucket;
  /** Keep compressed image locally in draft state and upload only on final form submit. */
  deferUpload?: boolean;
}

/** Camera sheet: capture with the device camera or choose an existing photo. */
export const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  mode,
  title,
  hint,
  onClose,
  onCapture,
  onScan,
  demoImage,
  bucket = 'book-listings',
  deferUpload = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const [state, setState] = useState<'LOADING' | 'LIVE' | 'NO_CAMERA'>('LOADING');
  const [shot, setShot] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    selectedFileRef.current = null;
    setShot(null);
    setScanning(false);
    setUploading(false);
    setUploadError(null);
    setState('LOADING');

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setState('LIVE');
      } catch {
        if (!cancelled) setState('NO_CAMERA');
      }
    };
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const takePhoto = () => {
    const video = videoRef.current;
    selectedFileRef.current = null;
    setUploadError(null);
    if (state === 'LIVE' && video && video.videoWidth) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      setShot(canvas.toDataURL('image/jpeg', 0.85));
      return;
    }
    if (demoImage) setShot(demoImage);
  };

  const pickFromGallery = async (file?: File | null) => {
    if (!file) return;
    setUploadError(null);
    setPreparingPhoto(true);
    try {
      const normalized = await prepareImageForPreviewAndUpload(file);
      selectedFileRef.current = normalized;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setShot(reader.result);
      };
      reader.onerror = () => {
        setUploadError('ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองเลือกรูปอื่น');
      };
      reader.readAsDataURL(normalized);
    } catch (err) {
      selectedFileRef.current = null;
      setUploadError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเตรียมไฟล์รูปภาพได้ กรุณาลองเลือกรูปอื่น'
      );
    } finally {
      setPreparingPhoto(false);
    }
  };

  const confirmPhoto = async () => {
    if (!shot || uploading) return;
    if (demoImage && shot === demoImage) {
      onCapture?.(shot);
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      if (deferUpload) {
        const localDataUrl = await compressImageToDataUrl(selectedFileRef.current ?? shot);
        onCapture?.(localDataUrl);
      } else {
        const result = await uploadImageFile(selectedFileRef.current ?? shot, bucket);
        onCapture?.(result.url);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : deferUpload
            ? 'เตรียมรูปภาพไม่สำเร็จ กรุณาลองใหม่'
            : 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่'
      );
    } finally {
      setUploading(false);
    }
  };

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      onScan?.();
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative w-full max-w-[430px] h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 text-white">
          <button type="button" onClick={onClose} aria-label="ปิดกล้อง" className="p-2 -ml-2 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold">{title}</span>
          <span className="w-9" />
        </header>

        <div className="relative flex-1 overflow-hidden bg-slate-950">
          {shot ? (
            <img src={shot} alt="รูปที่ถ่าย" className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className={clsx('absolute inset-0 w-full h-full object-cover', state !== 'LIVE' && 'hidden')}
            />
          )}

          {!shot && state === 'LOADING' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              กำลังเปิดกล้อง…
            </div>
          )}

          {!shot && state === 'NO_CAMERA' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
              <CameraOff className="w-10 h-10" />
              <p className="text-sm font-semibold">เปิดกล้องไม่ได้</p>
              <p className="text-[11px] text-white/60 leading-relaxed">
                อนุญาตการใช้กล้องในเบราว์เซอร์ หรือเปิดผ่านแอป LINE บนมือถือ
                {mode === 'PHOTO' ? ' · หรือเลือกรูปจากแกลอรี่ด้านล่าง' : ''}
              </p>
            </div>
          )}

          {mode === 'SCAN' && !shot && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-60 h-60">
                <span className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl" />
                <span className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl" />
                <span className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl" />
                <span className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl" />
                <span className="absolute left-3 right-3 h-0.5 bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.9)] animate-scan-line" />
              </div>
            </div>
          )}
        </div>

        <footer className="px-5 pt-4 pb-6 safe-area-bottom space-y-3 bg-black">
          {hint && <p className="text-center text-[11px] text-white/70 leading-relaxed">{hint}</p>}
          {uploadError && (
            <p className="text-center text-xs text-rose-300 bg-rose-950/60 border border-rose-500/30 rounded-xl px-3 py-2">
              {uploadError}
            </p>
          )}

          {mode === 'PHOTO' ? (
            shot ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setShot(null);
                    selectedFileRef.current = null;
                    setUploadError(null);
                  }}
                  className="min-h-[48px] rounded-xl border border-white/30 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCcw className="w-4 h-4" />
                  ถ่ายใหม่
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={confirmPhoto}
                  className="min-h-[48px] rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-70"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {deferUpload ? 'กำลังเตรียมรูป…' : 'กำลังอัปโหลด…'}
                    </>
                  ) : (
                    'ใช้รูปนี้'
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-8">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={preparingPhoto}
                    aria-label="เลือกจากแกลอรี่"
                    className="w-12 h-12 rounded-xl border border-white/30 flex items-center justify-center text-white active:scale-95 transition disabled:opacity-50"
                  >
                    {preparingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={takePhoto}
                    disabled={state === 'LOADING' || (state === 'NO_CAMERA' && !demoImage)}
                    aria-label="ถ่ายรูป"
                    className="w-16 h-16 rounded-full bg-white border-4 border-white/40 ring-4 ring-white/20 flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
                  >
                    <Camera className="w-6 h-6 text-slate-900" />
                  </button>
                  <span className="w-12 h-12" />
                </div>
                <span className="text-[10px] text-white/60">
                  {preparingPhoto ? 'กำลังแปลงไฟล์รูปภาพ…' : 'แกลอรี่ · ถ่ายรูป'}
                </span>
                {state === 'NO_CAMERA' && demoImage && (
                  <span className="text-[10px] text-white/50">โหมดทดลอง: กดปุ่มเพื่อใช้รูปตัวอย่าง</span>
                )}
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={simulateScan}
              disabled={scanning}
              className="w-full min-h-[50px] rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {scanning ? 'กำลังอ่าน QR…' : 'สแกน QR ของผู้ซื้อ'}
            </button>
          )}
          {mode === 'PHOTO' && (
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="hidden"
              onChange={(event) => {
                pickFromGallery(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          )}
        </footer>
      </div>
    </div>
  );
};
