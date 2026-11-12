'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import {
  Button,
  BottomSheet,
  Input,
  Stepper,
  Toast,
  EmptyState,
} from '@/components/ui';
import { useListing } from '@/hooks/useListing';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import {
  ScanLine,
  BookOpen,
  Layers,
  Plus,
  Trash2,
  ShieldAlert,
  ChevronRight,
  Check,
  Info,
} from 'lucide-react';

const MOCK_LOOKUP = {
  title: 'Atomic Habits เพราะชีวิตดีได้กว่าที่เป็น',
  author: 'James Clear',
  publisher: 'บิงโก',
  originalPrice: 295,
};

export default function SellerListStep1Page() {
  const router = useRouter();
  const { scanCode, isMock } = useLiff();
  const { isShopSetup } = useSeller();
  const { draft, update, toggleMissingVolume, resetDraft } = useListing();

  const [isManualIsbnOpen, setIsManualIsbnOpen] = useState(false);
  const [isManualInfoOpen, setIsManualInfoOpen] = useState(false);
  const [isMissingOpen, setIsMissingOpen] = useState(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualPublisher, setManualPublisher] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [volumes, setVolumes] = useState<{ volume: number; isbn: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSet = draft.mode === 'SET';

  const applyLookup = (isbn: string) => {
    update({
      isbn,
      title: MOCK_LOOKUP.title,
      author: MOCK_LOOKUP.author,
      publisher: MOCK_LOOKUP.publisher,
      originalPrice: MOCK_LOOKUP.originalPrice,
    });
    setToastMessage(`พบข้อมูลหนังสือจากเลข ISBN ${isbn}`);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    const scanned = await scanCode();
    setIsScanning(false);
    if (scanned) {
      applyLookup(scanned);
      return;
    }
    // Fallback when outside LINE or when scanCodeV2 is not available
    setIsManualIsbnOpen(true);
  };

  const handleAddVolume = () => {
    const nextVolume = volumes.length + 1;
    setVolumes((prev) => [
      ...prev,
      { volume: nextVolume, isbn: `97861657512${String(nextVolume).padStart(2, '0')}` },
    ]);
    update({ totalVolumes: Math.max(draft.totalVolumes, nextVolume) });
  };

  const handleNext = () => {
    if (!isShopSetup) {
      setError('ตั้งชื่อร้านก่อนลงขายหนังสือ');
      return;
    }
    if (!draft.title.trim()) {
      setError('กรุณาสแกนหรือกรอกข้อมูลหนังสือก่อนไปขั้นตอนต่อไป');
      return;
    }
    router.push('/seller/list/step-2');
  };

  if (!isShopSetup) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="ลงขายหนังสือ" />
        <div className="p-4 flex-1">
          <div className="bg-white rounded-2xl border border-slate-200 mt-6">
            <EmptyState
              icon={<ShieldAlert className="w-8 h-8 text-amber-500" />}
              title="ตั้งร้านก่อนลงขาย"
              description="ตั้งชื่อร้านและจุดนัดรับ ใช้เวลาประมาณ 1 นาที · ไม่ต้องใช้ชื่อจริง เบอร์โทร หรือบัญชีธนาคาร"
              actionText="ไปตั้งร้าน"
              onAction={() => router.push('/seller/setup')}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="ลงขายหนังสือ" onBack={() => router.push('/seller')} />

      <Stepper currentStep={1} />

      <div className="px-4 pt-3">
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            วันนี้ลงขายแล้ว 2 / 10 รายการ
          </span>
          <span className="text-slate-400">ลงขายฟรี · จำกัดวันละ 10</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Single / Set mode toggle (S2 / S2B) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              resetDraft('SINGLE');
              setVolumes([]);
            }}
            className={`p-3 rounded-2xl border text-left transition ${
              !isSet
                ? 'border-[#06C755] bg-emerald-50/60 ring-2 ring-[#06C755]/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <BookOpen
              className={`w-5 h-5 mb-1.5 ${!isSet ? 'text-[#059669]' : 'text-slate-400'}`}
            />
            <div className="text-sm font-bold text-slate-800">ขายเล่มเดียว</div>
            <div className="text-[11px] text-slate-500">หนังสือ 1 เล่ม</div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isSet) resetDraft('SET');
            }}
            className={`p-3 rounded-2xl border text-left transition ${
              isSet
                ? 'border-[#06C755] bg-emerald-50/60 ring-2 ring-[#06C755]/20'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <Layers
              className={`w-5 h-5 mb-1.5 ${isSet ? 'text-[#059669]' : 'text-slate-400'}`}
            />
            <div className="text-sm font-bold text-slate-800">ขายยกชุด</div>
            <div className="text-[11px] text-slate-500">หลายเล่มในราคาเดียว</div>
          </button>
        </div>

        {/* Scan card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isSet ? 'ขั้นที่ 1 · สแกนบาร์โค้ดทุกเล่ม' : 'ขั้นที่ 1 · สแกนบาร์โค้ด ISBN'}
            </h3>
            {isMock && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                โหมดจำลอง
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 flex flex-col items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <div className="w-12 h-12 rounded-full bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
              <ScanLine className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-emerald-800">
              {isScanning ? 'กำลังเปิดกล้อง...' : 'สแกนบาร์โค้ดหลังปก'}
            </span>
            <span className="text-[11px] text-emerald-700/80">
              ใช้กล้องของ LINE · ถ้าสแกนไม่ได้ให้พิมพ์เลขเอง
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => setIsManualIsbnOpen(true)}
            >
              พิมพ์เลข ISBN เอง
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => setIsManualInfoOpen(true)}
            >
              ไม่มี ISBN · กรอกเอง
            </Button>
          </div>
        </div>

        {/* Book found card */}
        {draft.title ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <Check className="w-4 h-4 stroke-[3]" />
              พบข้อมูลหนังสือแล้ว
            </div>
            <div className="flex gap-3">
              <div className="w-14 h-18 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center text-slate-300">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                  {draft.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{draft.author}</p>
                <p className="text-[11px] text-slate-400">
                  {draft.publisher} · ISBN {draft.isbn || '-'}
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  ราคาปก ฿{draft.originalPrice.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => update({ title: '', author: '', publisher: '', isbn: '', originalPrice: 0 })}
              className="text-[11px] text-slate-400 hover:text-rose-500 transition"
            >
              ลบข้อมูลนี้และสแกนใหม่
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              ระบบจะดึงชื่อหนังสือ ปก และราคาปกให้อัตโนมัติ เมื่อสแกนหรือกรอกเลข ISBN 13 หลัก
            </span>
          </div>
        )}

        {/* Set volumes list (S2B) */}
        {isSet && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                เล่มที่สแกนแล้ว ({volumes.length}/{draft.totalVolumes})
              </h3>
              <button
                type="button"
                onClick={() => setIsMissingOpen(true)}
                className="text-[11px] font-semibold text-sky-600 hover:underline"
              >
                เล่มที่ขาดหาย
              </button>
            </div>

            {volumes.length === 0 ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                สแกนบาร์โค้ดทีละเล่ม ระบบจะนับจำนวนเล่มและตรวจเล่มที่ขาดให้อัตโนมัติ
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {volumes.map((v) => (
                  <div
                    key={v.volume}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 font-bold flex items-center justify-center">
                        {v.volume}
                      </span>
                      <span className="font-mono text-slate-600">{v.isbn}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`ลบเล่มที่ ${v.volume}`}
                      onClick={() =>
                        setVolumes((prev) => prev.filter((x) => x.volume !== v.volume))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {draft.missingVolumes.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                แจ้งไว้แล้วว่าเล่มที่ขาด: {draft.missingVolumes.join(', ')}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              fullWidth
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAddVolume}
            >
              สแกนเล่มถัดไป
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            ถัดไป · ถ่ายรูปหนังสือ
          </Button>
        </div>
      </div>

      {/* S2M — type ISBN manually */}
      <BottomSheet
        isOpen={isManualIsbnOpen}
        onClose={() => setIsManualIsbnOpen(false)}
        title="พิมพ์เลข ISBN เอง (S2M)"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={manualIsbn.replace(/\D/g, '').length < 10}
            onClick={() => {
              applyLookup(manualIsbn.replace(/\D/g, ''));
              setIsManualIsbnOpen(false);
              setManualIsbn('');
            }}
          >
            ค้นหาหนังสือ
          </Button>
        }
      >
        <div className="space-y-3 py-1">
          <Input
            label="เลข ISBN (10 หรือ 13 หลัก)"
            placeholder="เช่น 9786160838257"
            inputMode="numeric"
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
            helperText="ดูเลข ISBN ได้ที่ด้านหลังปก ใต้บาร์โค้ด"
          />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ใน LINE ให้ใช้ปุ่มสแกนบาร์โค้ดก่อน ถ้ากล้องอ่านไม่ชัดจึงพิมพ์เลขเอง
          </p>
        </div>
      </BottomSheet>

      {/* S2N — enter book info manually (no ISBN) */}
      <BottomSheet
        isOpen={isManualInfoOpen}
        onClose={() => setIsManualInfoOpen(false)}
        title="กรอกข้อมูลหนังสือเอง (S2N)"
        footer={
          <Button
            fullWidth
            size="lg"
            disabled={!manualTitle.trim() || !manualAuthor.trim()}
            onClick={() => {
              update({
                isbn: '',
                title: manualTitle.trim(),
                author: manualAuthor.trim(),
                publisher: manualPublisher.trim(),
                originalPrice: Number(manualPrice) || 0,
              });
              setIsManualInfoOpen(false);
              setToastMessage('บันทึกข้อมูลหนังสือแล้ว');
            }}
          >
            ใช้ข้อมูลนี้
          </Button>
        }
      >
        <div className="space-y-3 py-1">
          <Input
            label="ชื่อหนังสือ"
            placeholder="เช่น หนังสือที่ไม่มีเลข ISBN"
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
          />
          <Input
            label="ผู้แต่ง"
            placeholder="ชื่อผู้แต่ง"
            value={manualAuthor}
            onChange={(e) => setManualAuthor(e.target.value)}
          />
          <Input
            label="สำนักพิมพ์"
            placeholder="เช่น สำนักพิมพ์ผีเสื้อ"
            value={manualPublisher}
            onChange={(e) => setManualPublisher(e.target.value)}
          />
          <Input
            label="ราคาปก (บาท)"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            helperText="ใช้คำนวณราคาแนะนำในขั้นตอนสุดท้าย"
          />
        </div>
      </BottomSheet>

      {/* TMISSING — mark missing volumes */}
      <BottomSheet
        isOpen={isMissingOpen}
        onClose={() => setIsMissingOpen(false)}
        title="แจ้งเล่มที่ขาดหาย (TMISSING)"
        footer={
          <Button fullWidth size="lg" onClick={() => setIsMissingOpen(false)}>
            บันทึกเล่มที่ขาด
          </Button>
        }
      >
        <div className="space-y-2 py-1">
          <p className="text-xs text-slate-500 leading-relaxed pb-2">
            เลือกเล่มที่ไม่มีในชุด ระบบจะแสดงข้อมูลนี้บนหน้าประกาศขาย
            เพื่อให้ผู้ซื้อตัดสินใจได้ถูกต้อง
          </p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: draft.totalVolumes }, (_, i) => i + 1).map((vol) => {
              const selected = draft.missingVolumes.includes(vol);
              return (
                <button
                  key={vol}
                  type="button"
                  onClick={() => toggleMissingVolume(vol)}
                  className={`h-11 rounded-xl border text-sm font-bold transition ${
                    selected
                      ? 'bg-rose-500 border-rose-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {vol}
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
