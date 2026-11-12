'use client';

import React, { useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/Button';
import {
  RICH_MENU_ITEMS,
  FLEX_TEMPLATES,
  sendFlex,
  type FlexTemplate,
} from '@/lib/lineAssets';
import { MessageSquare, Menu, Copy, Send, Check } from 'lucide-react';

export default function LinePreviewPage() {
  const [selected, setSelected] = useState<FlexTemplate>(FLEX_TEMPLATES[0]);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected.flex, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const trySend = async () => {
    const result = await sendFlex('Udemo_buyer', selected.id);
    setSent(`ส่ง mock แล้ว: ${result.templateId}`);
    setTimeout(() => setSent(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-12">
      <TopBar title="LINE assets (Phase 6)" subtitle="Rich Menu + Flex templates · spec only" />

      <div className="p-4 space-y-6 max-w-[430px] mx-auto w-full">
        {/* Rich Menu */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Menu className="w-4 h-4 text-[#06C755]" />
            <h2 className="text-sm font-bold text-slate-900">Rich Menu (spec only)</h2>
          </div>
          <p className="text-xs text-slate-500">
            5 ปุ่ม · แต่ละปุ่มเปิด LIFF deep link · ไม่เรียก LINE API
          </p>
          <div className="grid grid-cols-5 gap-2">
            {RICH_MENU_ITEMS.map((item) => (
              <div
                key={item.label}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-100 text-center"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-bold text-slate-700 leading-tight">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
          <ul className="space-y-1.5 pt-1">
            {RICH_MENU_ITEMS.map((item) => (
              <li key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {item.icon} {item.label}
                </span>
                <code className="text-[10px] text-slate-400 truncate max-w-[180px]">
                  liff.line.me/…{item.path}
                </code>
              </li>
            ))}
          </ul>
        </section>

        {/* Flex templates */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#06C755]" />
            <h2 className="text-sm font-bold text-slate-900">Flex Message templates</h2>
          </div>
          <p className="text-xs text-slate-500">
            {FLEX_TEMPLATES.length} templates · คลิกเพื่อดู JSON · ใช้กับ LINE Flex Message Simulator
          </p>

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {FLEX_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  selected.id === t.id
                    ? 'bg-[#06C755] text-white border-[#06C755]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {t.event}
              </button>
            ))}
          </div>

          {/* Preview bubble */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
            <div className="text-xs font-bold text-slate-800">{selected.title}</div>
            <div className="text-xs text-slate-600 leading-relaxed">{selected.body}</div>
            <div className="pt-2">
              <span className="inline-block px-3 py-1.5 rounded-lg bg-[#06C755] text-white text-xs font-bold">
                {selected.ctaLabel}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 pt-1">
              trigger: {selected.trigger}
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copyJson}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'คัดลอกแล้ว' : 'คัดลอก JSON'}
            </Button>
            <Button size="sm" onClick={trySend}>
              <Send className="w-4 h-4" />
              ทดสอบ sendFlex (mock)
            </Button>
          </div>
          {sent && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {sent}
            </div>
          )}

          <pre className="text-[10px] bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto max-h-64">
            {JSON.stringify(selected.flex, null, 2)}
          </pre>
        </section>

        {/* Trigger map */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Event → template map</h2>
          <ul className="space-y-2">
            {FLEX_TEMPLATES.map((t) => (
              <li key={t.id} className="text-xs border-b border-slate-50 pb-2 last:border-0">
                <div className="font-semibold text-slate-700">{t.event}</div>
                <div className="text-slate-500">{t.trigger}</div>
              </li>
            ))}
          </ul>
        </section>

        <div className="text-[10px] text-slate-400 text-center">
          ไม่มีการเรียก LINE API · sendFlex เป็น stub ที่ log payload เท่านั้น
        </div>
      </div>
    </div>
  );
}
