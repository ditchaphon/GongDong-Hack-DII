'use client';

import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Lock,
  Send,
  EyeOff,
  ImageOff,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { ChatMessage, V4OrderStatus, ViewRole } from '@/types/v4';
import { canChat, isChatReadOnly } from '@/lib/orderStateMachine';
import { describeLeaks, hasContactLeak, maskContact } from '@/lib/masking';

export interface ChatRoomProps {
  messages: ChatMessage[];
  role: ViewRole;
  status: V4OrderStatus;
  otherName: string;
  otherAvatar?: string;
  orderLabel?: string;
  onSend?: (maskedText: string) => void;
  onProposeSchedule?: () => void;
  className?: string;
}

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

export const ChatRoom: React.FC<ChatRoomProps> = ({
  messages,
  role,
  status,
  otherName,
  otherAvatar,
  orderLabel,
  onSend,
  onProposeSchedule,
  className,
}) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const open = canChat(status);
  const readOnly = isChatReadOnly(status);
  const leak = hasContactLeak(draft);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed || readOnly || !open) return;
    onSend?.(maskContact(trimmed));
    setDraft('');
  };

  if (!open) {
    return (
      <div
        className={clsx(
          'rounded-2xl border border-slate-200 bg-white p-5 text-center space-y-2',
          className
        )}
      >
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">แชทจะเปิดหลังผู้ขายตอบรับคำขอ</h3>
        <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
          ระหว่างนี้ติดต่อกันไม่ได้ · ระบบจะแจ้งเตือนเมื่อมีความคืบหน้า
        </p>
      </div>
    );
  }

  return (
    <section
      className={clsx(
        'rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col',
        className
      )}
      aria-label={`แชทออเดอร์ ${orderLabel ?? ''}`}
    >
      {/* Header */}
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-white">
        {otherAvatar ? (
          <img
            src={otherAvatar}
            alt={otherName}
            className="w-8 h-8 rounded-full object-cover bg-slate-100"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-100" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate">{otherName}</div>
          <div className="text-[10px] text-slate-400 truncate">
            {orderLabel ? `ออเดอร์ ${orderLabel} · ` : ''}แชทในออเดอร์
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" />
          ปิดข้อมูลติดต่อ
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 max-h-[420px] overflow-y-auto px-3 py-3 space-y-2 bg-slate-50/60">
        {messages.length === 0 && (
          <p className="text-center text-[11px] text-slate-400 py-8">
            ยังไม่มีข้อความ · เริ่มทักทายหรือนัดรับได้เลย
          </p>
        )}

        {messages.map((message) => {
          if (message.kind === 'SYSTEM') {
            return (
              <div key={message.id} className="text-center">
                <span className="inline-block text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  {message.text}
                </span>
              </div>
            );
          }

          const mine = message.from === role;
          const isSchedule = message.kind === 'SCHEDULE_CARD';

          return (
            <div key={message.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={clsx(
                  'max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-2xs',
                  isSchedule
                    ? 'bg-teal-50 border border-teal-200 text-teal-900'
                    : mine
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white border border-slate-200 text-slate-700'
                )}
              >
                {isSchedule && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-teal-700 mb-0.5">
                    <CalendarClock className="w-3 h-3" />
                    ข้อความนัดรับ
                  </span>
                )}
                <p className="whitespace-pre-wrap">{maskContact(message.text)}</p>
                {(hasContactLeak(message.text) || message.text.includes('•••')) && (
                  <span
                    className={clsx(
                      'mt-1 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded',
                      mine && !isSchedule ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    <EyeOff className="w-2.5 h-2.5" />
                    ซ่อน{describeLeaks(message.text) || 'ข้อมูลติดต่อ'}แล้ว
                  </span>
                )}
                <span
                  className={clsx(
                    'block text-[9px] mt-1',
                    mine && !isSchedule ? 'text-white/70 text-right' : 'text-slate-400 text-right'
                  )}
                >
                  {timeOf(message.sentAtISO)}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Read-only / composer */}
      {readOnly ? (
        <div className="px-4 py-3 border-t border-slate-100 bg-white flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <EyeOff className="w-3.5 h-3.5" />
          ออเดอร์จบแล้ว · อ่านข้อความได้อย่างเดียว
        </div>
      ) : (
        <div className="border-t border-slate-100 bg-white">
          <div className="flex items-center justify-between px-3 pt-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <ImageOff className="w-3 h-3" />
              ส่งรูปในแชทไม่ได้ · ใช้แบบฟอร์มรายงานปัญหาแทน
            </span>
            {onProposeSchedule && (
              <button
                type="button"
                onClick={onProposeSchedule}
                className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary-dark)]"
              >
                <CalendarClock className="w-3 h-3" />
                นัดรับ
              </button>
            )}
          </div>

          {leak && (
            <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
              พบ{describeLeaks(draft)} · ระบบจะซ่อนเป็น ••• ก่อนส่ง เพื่อป้องกันการนัดนอกแอป
            </div>
          )}

          <div className="flex items-end gap-2 p-3">
            <textarea
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="พิมพ์ข้อความ (ห้ามส่งเบอร์หรือไลน์)"
              aria-label="ข้อความในแชท"
              className="flex-1 max-h-24 min-h-[44px] resize-none text-sm px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              aria-label="ส่งข้อความ"
              className="w-11 h-11 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
