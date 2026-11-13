'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { MOCK_CREDIT_PACKAGES } from '@/mocks/seller';
import { CREDIT_REASON_LABEL, sortLedger } from '@/lib/creditLedger';
import {
  CreditCard,
  Check,
  Sparkles,
  Info,
  ChevronRight,
  ShieldCheck,
  History,
  ShieldAlert,
} from 'lucide-react';

export default function SellerCreditsPage() {
  const router = useRouter();
  const { credits, selectedPackageId, setSelectedPackageId, shop, ledger } =
    useSeller();
  const payeeVerified = shop?.payeeVerified ?? false;
  const history = sortLedger(ledger).slice(0, 5);

  const selected =
    MOCK_CREDIT_PACKAGES.find((p) => p.id === selectedPackageId) ||
    MOCK_CREDIT_PACKAGES[1];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar title="เติมเครดิต" onBack={() => router.push('/seller')} />

      <div className="p-4 space-y-4">
        {/* Balance */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-50">
            <CreditCard className="w-4 h-4" />
            เครดิตคงเหลือ
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black">{credits}</span>
            <span className="text-sm text-emerald-50">เครดิต</span>
          </div>
          <p className="text-[11px] text-emerald-50/90 pt-1">
            1 เครดิต = รับได้ 1 ออเดอร์ · ลงขายฟรีเสมอ
          </p>
        </div>

        {!payeeVerified && (
          <button
            type="button"
            onClick={() => router.push('/seller/setup?step=4')}
            className="w-full flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="flex-1 text-[11px] text-amber-900 leading-relaxed">
              เติมเครดิตครั้งแรกต้องยืนยันตัวตน (KYC) ก่อน · ใช้ตรวจสลิปเท่านั้น
              ผู้ซื้อไม่เห็นข้อมูลนี้
            </span>
            <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
          </button>
        )}

        {/* Packages (S5) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              เลือกแพ็กเกจเครดิต
            </h3>
            <span className="text-[10px] text-slate-400">จ่ายครั้งเดียว ไม่ต่ออายุ</span>
          </div>

          {MOCK_CREDIT_PACKAGES.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`relative w-full text-left p-4 rounded-2xl border bg-white transition ${
                  isSelected
                    ? 'border-[#8B5E3C] ring-2 ring-[#8B5E3C]/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {pkg.isPopular && (
                  <span className="absolute -top-2 right-3 inline-flex items-center gap-1 bg-amber-400 text-amber-950 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Sparkles className="w-3 h-3" />
                    คุ้มที่สุด
                  </span>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#8B5E3C] border-[#8B5E3C] text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {pkg.name} · {pkg.credits} เครดิต
                      </div>
                      <div className="text-[11px] text-slate-500">{pkg.note}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-black text-slate-900">฿{pkg.price}</div>
                    <div className="text-[10px] text-slate-400">
                      ฿{(pkg.price / pkg.credits).toFixed(1)} / ออเดอร์
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <History className="w-4 h-4 text-slate-400" />
            ประวัติเครดิต
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-slate-400">ยังไม่มีรายการเคลื่อนไหว</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((entry) => (
                <div key={entry.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-slate-700 truncate">
                      {CREDIT_REASON_LABEL[entry.reason]}
                      {entry.orderId ? ` · #${entry.orderId}` : ''}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(entry.atISO).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xs font-bold ${
                        entry.delta > 0 ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                    </div>
                    <div className="text-[10px] text-slate-400">คงเหลือ {entry.balanceAfter}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            เครดิตถูกใช้เมื่อคุณกดรับออเดอร์เท่านั้น · ถ้าปฏิเสธออเดอร์ เครดิตไม่ถูกหัก ·
            เครดิตไม่มีวันหมดอายุ
          </span>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-600">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
          <span className="leading-relaxed">
            ชำระด้วยพร้อมเพย์ แล้วแนบสลิป · แอดมินตรวจสลิปและเติมเครดิตให้ภายใน 30 นาที
            ในเวลาทำการ
          </span>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button
            fullWidth
            size="lg"
            onClick={() =>
              router.push(
                payeeVerified ? '/seller/credits/pay' : '/seller/setup?step=4'
              )
            }
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            {payeeVerified
              ? `ชำระเงิน ฿${selected.price} · ${selected.credits} เครดิต`
              : 'ยืนยันบัญชีก่อนเติมเครดิต'}
          </Button>
        </div>
      </div>
    </div>
  );
}
