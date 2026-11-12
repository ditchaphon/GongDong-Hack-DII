'use client';

import React, { useState } from 'react';
import { ShieldCheck, ScanEye, Coins } from 'lucide-react';
import {
  ChatRoom,
  CodeInput,
  ConfirmSheet,
  CreditPackCard,
  DateTimePicker,
  HandoverCode,
  MapPinPicker,
  MaskedText,
  NextActionCard,
  OrderTimeline,
  PhotoGallery,
  QrPayCard,
  SlipResult,
  SlipUploader,
  StatusBadgeV4,
  TrackingForm,
  NicknameAvatarPicker,
} from '@/components/v4';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { MOCK_BOOKS } from '@/mocks/books';
import {
  MOCK_V4_CHAT,
  MOCK_V4_LEDGER,
  MOCK_V4_ORDERS,
  MOCK_V4_ORDER,
} from '@/mocks/v4';
import { CREDIT_PACKS, CREDIT_REASON_LABEL, balanceOf, sortLedger } from '@/lib/creditLedger';
import { findContactLeaks } from '@/lib/masking';
import { SlipCheckState, V4OrderStatus } from '@/types/v4';
import { MapPoint } from '@/components/v4/MapPinPicker';
import { ScheduleValue } from '@/components/v4/DateTimePicker';
import { TrackingValue } from '@/components/v4/TrackingForm';
import { formatTHB } from '@/lib/qr';

const ALL_STATUSES: V4OrderStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'SCHEDULED',
  'PAID',
  'SHIPPED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'DISPUTED',
];

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="space-y-3">
    <div>
      <h2 className="text-sm font-black text-slate-900">{title}</h2>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{hint}</p>}
    </div>
    {children}
  </section>
);

export const V4Showcase: React.FC = () => {
  const [point, setPoint] = useState<MapPoint | null>({ lat: 18.8023, lng: 98.9524 });
  const [landmark, setLandmark] = useState('หน้าหอสมุดกลาง มช. ใต้ต้นไม้ใหญ่');
  const [schedule, setSchedule] = useState<ScheduleValue | null>(null);
  const [slip, setSlip] = useState('');
  const [slipState, setSlipState] = useState<SlipCheckState>('CHECKING');
  const [code, setCode] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pack, setPack] = useState('bookworm');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nickname, setNickname] = useState('สกายอ่านหนังสือ');
  const [avatar, setAvatar] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'
  );
  const [consent, setConsent] = useState(false);
  const [tracking, setTracking] = useState<TrackingValue>({
    carrier: '',
    trackingNumber: '',
    boxPhoto: '',
  });

  const meetupOrder = MOCK_V4_ORDERS[4];
  const parcelOrder = MOCK_V4_ORDERS[6];
  const chatOrder = MOCK_V4_ORDERS[2];
  const balance = balanceOf(MOCK_V4_LEDGER);

  const galleryPhotos = [
    { src: MOCK_BOOKS[0].photos.cover, label: 'ปกหน้า + ป้ายชื่อร้าน' },
    { src: MOCK_BOOKS[0].photos.back, label: 'ปกหลัง' },
    { src: MOCK_BOOKS[0].photos.spine, label: 'สันหนังสือ' },
    {
      src: MOCK_BOOKS[0].photos.nameTag,
      label: 'รอยพับที่มุมปก',
      isDefect: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <h2 className="text-base font-black text-slate-900">v4 components (Phase 1)</h2>
        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
          บล็อกที่ v4 ต้องใช้ทุกหน้า · ข้อมูลทั้งหมดเป็น mock · ไม่มีเบอร์โทรหรือไลน์ในตัวอย่าง
        </p>
      </div>

      <Section
        title="Status + timeline"
        hint="สถานะ 10 แบบของ v4 และเส้นทางหลักแยกตามวิธีรับ"
      >
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((status) => (
            <StatusBadgeV4 key={status} status={status} />
          ))}
        </div>
        <div className="grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              นัดรับ · นัดแล้ว (SCHEDULED)
            </p>
            <OrderTimeline order={meetupOrder} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">
              ส่งพัสดุ · จัดส่งแล้ว (SHIPPED)
            </p>
            <OrderTimeline order={parcelOrder} />
          </div>
        </div>
      </Section>

      <Section
        title="Next action (who acts + timer)"
        hint="การ์ดเดียวต่อออเดอร์: บอกว่าใครต้องทำ เหลือเวลาเท่าไร และปุ่มหลักคืออะไร"
      >
        <NextActionCard order={MOCK_V4_ORDERS[3]} role="BUYER" />
        <NextActionCard order={MOCK_V4_ORDERS[3]} role="SELLER" />
      </Section>

      <Section title="Chat + masking" hint="เปิดหลังรับออเดอร์ · เบอร์/ไลน์ถูกปิดเป็น •••">
        <ChatRoom
          messages={MOCK_V4_CHAT}
          role="BUYER"
          status={chatOrder.status}
          otherName={chatOrder.shop.shopName}
          otherAvatar={chatOrder.shop.avatar}
          orderLabel={chatOrder.id}
        />
        <ChatRoom
          messages={[]}
          role="SELLER"
          status="REQUESTED"
          otherName={MOCK_V4_ORDER.buyer.nickname}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <p className="text-[11px] font-semibold text-slate-500">MaskedText</p>
          <p className="text-xs text-slate-700">
            <MaskedText text="ติดต่อ 099-999-9999 หรือไลน์ @gongdong นะครับ" />
          </p>
          <div className="flex flex-wrap gap-1.5">
            {findContactLeaks('โอนเข้าบัญชี 1234567890 line: gongdong').map((leak) => (
              <Chip key={`${leak.kind}-${leak.value}`} label={leak.kind} size="sm" />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Meetup: pin + date/time" hint="ไม่มีรายการโซนแล้ว · ปักหมุดและใส่จุดสังเกต">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <MapPinPicker
            value={point}
            onChange={setPoint}
            landmark={landmark}
            onLandmarkChange={setLandmark}
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <DateTimePicker value={schedule} onChange={setSchedule} />
        </div>
      </Section>

      <Section title="Payment" hint="QR + เตือนตรวจชื่อผู้รับ · สลิปมีผลตรวจ 4 สถานะ">
        <QrPayCard
          amount={170}
          recipientLabel="ป้า••• · ผู้ขาย"
          reference="ORD-V4-1004"
          onOpenBankApp={() => undefined}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <SlipUploader
            previewUrl={slip}
            onChange={setSlip}
            onRemove={() => setSlip('')}
            amountLabel={formatTHB(170)}
          />
          <div className="flex flex-wrap gap-1.5">
            {(['CHECKING', 'PASSED', 'FAILED', 'ADMIN_REVIEW'] as const).map((state) => (
              <Chip
                key={state}
                label={state}
                selected={slipState === state}
                onClick={() => setSlipState(state)}
                size="sm"
              />
            ))}
          </div>
          <SlipResult
            state={slipState as Exclude<SlipCheckState, 'NONE'>}
            onRetry={() => setSlip('')}
          />
        </div>
      </Section>

      <Section title="Handover code" hint="ผู้ซื้อเห็นรหัส · ผู้ขายกรอกรหัส · รหัสไม่เคยถูกส่งให้ผู้ขาย">
        <HandoverCode code="482913" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={() => undefined}
            onSubmit={() => undefined}
            attemptsLeft={3}
            expiresLabel="กรอกรหัสได้ภายใน 48 ชม. หลังเวลานัด"
          />
        </div>
      </Section>

      <Section title="Parcel tracking form" hint="ขนส่ง + เลขพัสดุ + รูปกล่อง ภายใน 48 ชม.">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <TrackingForm
            value={tracking}
            onChange={(patch) => setTracking((prev) => ({ ...prev, ...patch }))}
            onSubmit={() => undefined}
            deadlineISO={new Date(Date.now() + 40 * 3600 * 1000).toISOString()}
          />
        </div>
      </Section>

      <Section title="Photo gallery (watermarked)" hint="รูปจริง 4 ด้าน + รูปตำหนิ พร้อมลายน้ำ">
        <Button variant="outline" onClick={() => setGalleryOpen(true)}>
          เปิดแกลเลอรีตัวอย่าง
        </Button>
        <PhotoGallery
          isOpen={galleryOpen}
          photos={galleryPhotos}
          shopName="ป้าหนอนหนังสือ"
          onClose={() => setGalleryOpen(false)}
        />
      </Section>

      <Section title="Credits" hint="แพ็กเกจ + ledger (เติม/ใช้/คืนเครดิต)">
        <div className="space-y-2.5">
          {CREDIT_PACKS.map((item) => (
            <CreditPackCard
              key={item.id}
              pack={item}
              selected={pack === item.id}
              onSelect={setPack}
            />
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-600" />
              เครดิตคงเหลือ
            </span>
            <span>{balance} เครดิต</span>
          </div>
          <div className="divide-y divide-slate-100">
            {sortLedger(MOCK_V4_LEDGER).map((entry) => (
              <div key={entry.id} className="py-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-600">{CREDIT_REASON_LABEL[entry.reason]}</span>
                <span
                  className={
                    entry.delta > 0 ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'
                  }
                >
                  {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Confirm + identity" hint="ยืนยันก่อนหักเครดิต/ปิดออเดอร์ · ชื่อเล่นและรูปแทนโปรไฟล์ LINE">
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          เปิด ConfirmSheet
        </Button>
        <ConfirmSheet
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="รับออเดอร์นี้?"
          description="ใช้ 1 เครดิต · ปฏิเสธไม่เสียเครดิต"
          confirmLabel="ใช้ 1 เครดิต"
          onConfirm={() => setConfirmOpen(false)}
        >
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            เครดิตคงเหลือ {balance} · หลังรับจะเหลือ {balance - 1}
          </div>
        </ConfirmSheet>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <NicknameAvatarPicker
            nickname={nickname}
            onNicknameChange={setNickname}
            avatar={avatar}
            onAvatarChange={setAvatar}
            consent={consent}
            onConsentChange={setConsent}
          />
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          ไม่มีเบอร์โทร/ไลน์ในทุกบล็อก
        </div>
        <div className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-1.5">
          <ScanEye className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
          ตรวจชื่อผู้รับก่อนโอนทุกครั้ง
        </div>
      </div>
    </div>
  );
};
