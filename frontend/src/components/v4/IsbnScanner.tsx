'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, Loader2, ScanLine, X } from 'lucide-react';
import type { IScannerControls } from '@zxing/browser';

export interface IsbnScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (isbn: string) => void;
  onManual: () => void;
  onNoIsbn: () => void;
}

/**
 * Full-screen ISBN barcode scanner. Uses the device camera through ZXing and
 * accepts EAN-13/EAN-8/UPC-A barcodes found on the back cover.
 */
export const IsbnScanner: React.FC<IsbnScannerProps> = ({
  isOpen,
  onClose,
  onDetected,
  onManual,
  onNoIsbn,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const doneRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [state, setState] = useState<'STARTING' | 'LIVE' | 'ERROR'>('STARTING');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    doneRef.current = false;
    setState('STARTING');
    setMessage(null);

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);
        const reader = new BrowserMultiFormatReader(hints as never, {
          delayBetweenScanAttempts: 200,
        });
        if (!videoRef.current || cancelled) return;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (result) => {
            if (!result || doneRef.current) return;
            const isbn = result.getText().replace(/\D/g, '');
            if (isbn.length !== 10 && isbn.length !== 13) return;
            doneRef.current = true;
            controlsRef.current?.stop();
            onDetectedRef.current(isbn);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState('LIVE');
      } catch {
        if (!cancelled) {
          setState('ERROR');
          setMessage('เปิดกล้องไม่ได้ · อนุญาตการใช้กล้องในเบราว์เซอร์ หรือเปิดผ่านแอป LINE บนมือถือ');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="สแกนบาร์โค้ด ISBN"
    >
      <div className="relative w-full max-w-[430px] h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดกล้อง"
            className="p-2 -ml-2 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold">สแกนบาร์โค้ด ISBN</span>
          <span className="w-9" />
        </header>

        <div className="relative flex-1 overflow-hidden bg-slate-950">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {state === 'STARTING' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70 text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              กำลังเปิดกล้อง…
            </div>
          )}

          {state === 'ERROR' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
              <CameraOff className="w-10 h-10" />
              <p className="text-sm font-semibold">เปิดกล้องไม่ได้</p>
              <p className="text-[11px] text-white/60 leading-relaxed">{message}</p>
            </div>
          )}

          {state !== 'ERROR' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-72 h-40">
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
          <p className="text-center text-[11px] text-white/70 leading-relaxed">
            <Camera className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
            เล็งบาร์โค้ดหลังปกให้อยู่ในกรอบ · ระบบอ่านเลข ISBN ให้อัตโนมัติ
          </p>
          <button
            type="button"
            onClick={onManual}
            className="w-full min-h-[48px] rounded-xl border border-white/30 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Keyboard className="w-4 h-4" />
            พิมพ์เลข ISBN เอง
          </button>
          <button
            type="button"
            onClick={onNoIsbn}
            className="w-full min-h-[48px] rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold inline-flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" />
            ไม่มีบาร์โค้ด · กรอกเอง
          </button>
        </footer>
      </div>
    </div>
  );
};
