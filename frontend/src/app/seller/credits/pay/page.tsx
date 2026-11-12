'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  PhotoUploader,
  Toast,
  Countdown,
} from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { MOCK_CREDIT_PACKAGES } from '@/mocks/seller';
import {
  Copy,
  CheckCircle2,
  QrCode,
  Info,
  ShieldCheck,
  Upload,
} from 'lucide-react';

const QR_SIZE = 21;

function buildQrCells(seed: string): boolean[] {
  const cells: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  for (let i = 0; i < QR_SIZE * QR_SIZE; i += 1) {
    hash = (hash * 1103515245 + 12345) % 2147483648;
    cells.push(hash % 100 < 47);
  }
  return cells;
}

function isFinderArea(row: number, col: number): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= QR_SIZE - 7;
  const inBottomLeft = row >= QR_SIZE - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

export default function SellerTopUpPayPage() {
  const router = useRouter();
  const { addCredits, selectedPackageId } = useSeller();

  const pkg =
    MOCK_CREDIT_PACKAGES.find((p) => p.id === selectedPackageId) ||
    MOCK_CREDIT_PACKAGES[1];

  const [slipUrl, setSlipUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cells = useMemo(() => buildQrCells(`gongdong-${pkg.id}-${pkg.price}`), [pkg]);

  const promptPayId = '089-765-4321';
  const accountName = 'กองดอง (นาย สกาย ระมัดระวัง)';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptPayId.replace(/\D/g, ''));
      setToastMessage('คัดลอกเลขพร้อมเพย์แล้ว');
    } catch {
      setToastMessage('เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอก กรุณาจดเลขไว้');
    }
  };

  const handleSubmit = () => {
    if (!slipUrl) {
      setToastMessage('กรุณาแนบสลิปการโอนเงินก่อนส่ง');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      addCredits(pkg.credits);
      setIsSubmitting(false);
      router.push('/seller/credits/success');
    }, 900);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ชำระเงิน · พร้อมเพย์" onBack={() => router.push('/seller/credits')} />

      <div className="p-4 space-y-4">
        {/* Amount */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center space-y-1">
          <div className="text-[11px] text-slate-400">
            แพ็กเกจ {pkg.name} · {pkg.credits} เครดิต
          </div>
          <div className="text-3xl font-black text-slate-900">฿{pkg.price}</div>
          <div className="text-[11px] text-slate-500">
            ใช้รับออเดอร์ได้ {pkg.credits} ครั้ง
          </div>
        </div>

        {/* QR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <QrCode className="w-4 h-4 text-[#06C755]" />
            สแกนจ่ายด้วยแอปธนาคาร (S5Q)
          </div>

          <div className="mx-auto w-52 h-52 p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className="w-full h-full" role="img" aria-label="ตัวอย่าง QR พร้อมเพย์">
              <rect width={QR_SIZE} height={QR_SIZE} fill="#ffffff" />
              {cells.map((filled, index) => {
                const row = Math.floor(index / QR_SIZE);
                const col = index % QR_SIZE;
                if (isFinderArea(row, col) || !filled) return null;
                return (
                  <rect
                    key={index}
                    x={col}
                    y={row}
                    width={1}
                    height={1}
                    fill="#0F172A"
                  />
                );
              })}
              {/* Finder patterns */}
              {[
                { x: 0, y: 0 },
                { x: QR_SIZE - 7, y: 0 },
                { x: 0, y: QR_SIZE - 7 },
              ].map((p) => (
                <g key={`${p.x}-${p.y}`}>
                  <rect x={p.x} y={p.y} width={7} height={7} fill="#0F172A" />
                  <rect x={p.x + 1} y={p.y + 1} width={5} height={5} fill="#ffffff" />
                  <rect x={p.x + 2} y={p.y + 2} width={3} height={3} fill="#0F172A" />
                </g>
              ))}
            </svg>
          </div>

          <p className="text-[10px] text-center text-slate-400">
            QR ตัวอย่างสำหรับเดโม · ยังไม่เชื่อมต่อระบบชำระเงินจริง
          </p>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">พร้อมเพย์</span>
              <span className="font-mono font-bold text-slate-900">{promptPayId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">ชื่อบัญชี</span>
              <span className="font-semibold text-slate-800 text-right">{accountName}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full mt-1 flex items-center justify-center gap-1.5 p-2 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5" />
              คัดลอกเลขพร้อมเพย์
            </button>
          </div>
        </div>

        <Countdown
          initialSeconds={30 * 60}
          label="กรุณาโอนและแนบสลิปภายใน"
        />

        {/* Slip upload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            แนบสลิปการโอนเงิน
          </h3>
          <PhotoUploader
            label="สลิปโอนเงิน"
            isRequired
            previewUrl={slipUrl}
            onChange={(url) => setSlipUrl(url)}
            onRemove={() => setSlipUrl('')}
            description="เห็นยอดเงิน วันเวลา และเลขที่รายการชัดเจน"
          />
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              สลิปต้องเป็นของบัญชีที่ใช้ยืนยันตัวตน · ถ้าชื่อไม่ตรง แอดมินจะไม่อนุมัติ
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span className="leading-relaxed">
            หลังแนบสลิป แอดมินจะตรวจและเติมเครดิตให้ภายใน 30 นาที (เวลาทำการ)
            คุณจะได้รับแจ้งเตือนใน LINE
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            isLoading={isSubmitting}
            disabled={!slipUrl}
            onClick={handleSubmit}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            ส่งสลิปให้แอดมินตรวจสอบ
          </Button>
        </div>
      </div>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
