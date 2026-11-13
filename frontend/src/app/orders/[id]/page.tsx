'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import {
  StatusBadgeV4,
  ChatRoom,
  ConfirmSheet,
  OrderSteps,
  MockQr,
  CameraCapture,
} from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { useSeller } from '@/hooks/useSeller';
import { STATUS_META, getTimerInfo, isTerminal } from '@/lib/orderStateMachine';
import { formatThaiDate, mapDirectionsUrl, mapEmbedUrl } from '@/lib/delivery';
import { V4Order, ViewRole } from '@/types/v4';
import {
  Clock,
  MapPin,
  Truck,
  Star,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  QrCode,
  ScanLine,
  Hourglass,
  Wallet,
  Copy,
  Package,
  EyeOff,
  Camera,
  ShieldCheck,
  Coins,
  X,
} from 'lucide-react';

const GRADE_LABEL: Record<string, string> = {
  LIKE_NEW: 'เหมือนใหม่',
  GENTLY_READ: 'สภาพดีมาก',
  WELL_LOVED: 'อ่านทั่วไป',
  WORN_BUT_READABLE: 'เน้นอ่าน',
};

const CARRIERS = ['Flash Express', 'Kerry Express', 'ไปรษณีย์ไทย', 'J&T Express', 'SPX Express'];

function trackingUrl(carrier: string | undefined, number: string) {
  const n = encodeURIComponent(number);
  switch (carrier) {
    case 'Flash Express':
      return `https://www.flashexpress.co.th/fle/tracking?se=${n}`;
    case 'Kerry Express':
      return `https://th.kerryexpress.com/th/track/?track=${n}`;
    case 'ไปรษณีย์ไทย':
      return `https://track.thailandpost.co.th/?trackNumber=${n}`;
    case 'J&T Express':
      return `https://www.jtexpress.co.th/service/track?billcode=${n}`;
    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ''} ${number}`)}`;
  }
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const buyerAlias = (order: V4Order) => `ผู้ซื้อ #${order.id.slice(-4)}`;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    getOrder,
    messagesFor,
    sendMessage,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    markShipped,
    openDispute,
    verifyHandover,
    isMineAsBuyer,
  } = useV4Orders();
  const { credits } = useSeller();

  const order = getOrder(id);

  const [toast, setToast] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [tracking, setTracking] = useState('');

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ออเดอร์" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">ไม่พบออเดอร์นี้ · อาจถูกลบหรือลิงก์ไม่ถูกต้อง</p>
      </div>
    );
  }

  const role: ViewRole = isMineAsBuyer(order) ? 'BUYER' : 'SELLER';
  const isBuyer = role === 'BUYER';
  const meta = STATUS_META[order.status];
  const timer = getTimerInfo(order);
  const chatOpen = !['REQUESTED', 'REJECTED', 'EXPIRED'].includes(order.status);
  const otherName = isBuyer ? order.shop.shopName : buyerAlias(order);

  const headline = (() => {
    const s = order.status;
    if (s === 'REQUESTED') return isBuyer ? 'รอผู้ขายตอบรับคำขอ' : 'มีคำขอซื้อใหม่ · ตอบรับเพื่อเริ่มขาย';
    if (s === 'SCHEDULED') return isBuyer ? 'นัดรับแล้ว · เปิด QR ตอนรับของ' : 'นัดรับแล้ว · สแกน QR ผู้ซื้อเพื่อปิดการขาย';
    if (s === 'ACCEPTED') return isBuyer ? 'ผู้ขายรับคำขอแล้ว · ชำระเงิน' : 'รอผู้ซื้อชำระเงิน';
    if (s === 'PAID') return isBuyer ? 'ผู้ขายกำลังเตรียมจัดส่ง' : 'ผู้ซื้อชำระเงินแล้ว · จัดส่งได้เลย';
    if (s === 'SHIPPED') return isBuyer ? 'ขนส่งกำลังนำส่ง' : 'ส่งแล้ว · รอผู้ซื้อยืนยันรับของ';
    if (s === 'COMPLETED') return isBuyer ? 'ได้รับหนังสือแล้ว' : 'ปิดการขายสำเร็จ';
    return meta.label;
  })();

  const handleAccept = () => {
    const result = acceptOrder(order.id);
    setAcceptOpen(false);
    setToast(result.ok ? 'รับออเดอร์แล้ว · ใช้ 1 เครดิต แชทเปิดแล้ว' : result.error || 'รับออเดอร์ไม่สำเร็จ');
  };

  const handleShip = () => {
    if (tracking.trim().length < 6) {
      setToast('กรอกเลขพัสดุให้ถูกต้อง');
      return;
    }
    markShipped(order.id, { ...order.shipping, carrier, trackingNumber: tracking.trim().toUpperCase() });
    setToast('แจ้งเลขพัสดุแล้ว · ผู้ซื้อติดตามได้ทันที');
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast('คัดลอกแล้ว');
    } catch {
      setToast(text);
    }
  };

  const meetupCard = order.schedule && (
    <div className="rounded-2xl border border-teal-200 bg-white overflow-hidden">
      <iframe
        title="แผนที่จุดนัดรับ"
        src={mapEmbedUrl(order.schedule.lat, order.schedule.lng)}
        className="w-full h-40 border-0 block"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="p-3 space-y-1.5 text-[11px] text-slate-700">
        <p className="flex items-start gap-1.5 font-bold text-slate-900 text-xs">
          <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
          {order.schedule.landmark}
        </p>
        <p className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {formatThaiDate(order.schedule.dateISO)} · {order.schedule.timeLabel}
        </p>
        <a
          href={mapDirectionsUrl(order.schedule.lat, order.schedule.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-teal-700"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          นำทางด้วย Google Maps
        </a>
      </div>
    </div>
  );

  const trackingCard = order.shipping?.trackingNumber && (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
          <Truck className="w-4 h-4" />
          {order.shipping.carrier}
        </span>
        <button type="button" onClick={() => copy(order.shipping!.trackingNumber!)} className="inline-flex items-center gap-1 font-semibold">
          <Copy className="w-3 h-3" /> คัดลอก
        </button>
      </div>
      <p className="font-mono text-base font-black tracking-wider text-slate-900">{order.shipping.trackingNumber}</p>
      <a
        href={trackingUrl(order.shipping.carrier, order.shipping.trackingNumber)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary-dark)]"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        ติดตามพัสดุที่เว็บขนส่ง
      </a>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-10">
      <TopBar title={`ออเดอร์ #${order.id}`} subtitle={isBuyer ? 'ฝั่งผู้ซื้อ' : 'ฝั่งร้านค้า'} onBack={() => router.push('/orders')} />

      <div className="p-4 space-y-4">
        {/* Header + steps */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <StatusBadgeV4 status={order.status} />
              <h1 className="text-base font-extrabold text-slate-900 mt-1.5 leading-snug">{headline}</h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {order.delivery === 'MEETUP' ? 'นัดรับ' : 'ส่งพัสดุ'} · {isBuyer ? order.shop.shopName : buyerAlias(order)}
              </p>
            </div>
            {timer && !isTerminal(order.status) && order.status !== 'DISPUTED' && (
              <span
                className={clsx(
                  'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 border',
                  timer.expired ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                )}
              >
                <Clock className="w-3 h-3" />
                {timer.expired ? 'หมดเวลา' : `${timer.hoursLeft} ชม.`}
              </span>
            )}
          </div>
          <OrderSteps order={order} />
          {['REJECTED', 'EXPIRED', 'CANCELLED'].includes(order.status) && (
            <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">{meta.explanation}</p>
          )}
          {order.status === 'DISPUTED' && (
            <p className="flex items-start gap-1.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              แอดมินกำลังตรวจสอบ{order.dispute ? ` · “${order.dispute.reason}”` : ''} · เวลาทั้งหมดหยุดชั่วคราว
            </p>
          )}
        </section>

        {/* ================= BUYER ================= */}
        {isBuyer && order.status === 'REQUESTED' && (
          <Panel icon={<Hourglass className="w-4 h-4 text-amber-600" />} title="ส่งคำขอแล้ว · รอผู้ขายตอบรับ">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ผู้ขายต้องตอบรับก่อนจึงจะไปขั้นต่อไปได้ · แชทจะเปิดเมื่อผู้ขายรับคำขอ · ยังไม่ต้องจ่ายเงิน
            </p>
            {order.delivery === 'MEETUP' ? meetupCard : (
              <AddressBlock order={order} />
            )}
            <button type="button" onClick={() => setCancelOpen(true)} className="w-full text-[11px] font-medium text-slate-400 hover:text-rose-500 pt-1">
              ยกเลิกคำขอนี้
            </button>
          </Panel>
        )}

        {isBuyer && order.status === 'SCHEDULED' && (
          <>
            <Panel icon={<QrCode className="w-4 h-4 text-emerald-700" />} title="QR รับของของคุณ">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ตรวจหนังสือให้ตรงเกรดและจ่ายเงินก่อน แล้วเปิด QR ให้ผู้ขายสแกนเพื่อปิดการขาย
              </p>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100/60"
              >
                <div className="relative w-16 h-16 rounded-xl bg-white border border-emerald-200 overflow-hidden flex items-center justify-center">
                  <MockQr value={order.handoverCode ?? order.id} size={56} className="blur-[3px] opacity-60" />
                  <EyeOff className="absolute w-5 h-5 text-emerald-800" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-900">แตะเพื่อแสดง QR</p>
                  <p className="text-[11px] text-emerald-700">ใช้ตอนเจอผู้ขายเท่านั้น · ห้ามส่งในแชท</p>
                </div>
              </button>
            </Panel>
            <Panel icon={<MapPin className="w-4 h-4 text-teal-600" />} title="รายละเอียดการนัดรับ">
              {meetupCard}
            </Panel>
          </>
        )}

        {isBuyer && order.status === 'ACCEPTED' && order.delivery === 'PARCEL' && (
          <Panel icon={<Wallet className="w-4 h-4 text-sky-600" />} title="ชำระเงินเพื่อให้ผู้ขายเริ่มจัดส่ง">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              สแกน QR พร้อมเพย์ของระบบและแนบสลิป · กองดองพักเงินไว้ และโอนให้ผู้ขายหลังคุณยืนยันรับของ
            </p>
            <Button fullWidth onClick={() => router.push(`/orders/${order.id}/pay`)}>
              ชำระเงิน ฿{order.total.toLocaleString()}
            </Button>
          </Panel>
        )}

        {isBuyer && order.status === 'PAID' && (
          <Panel icon={<Package className="w-4 h-4 text-sky-600" />} title="ผู้ขายกำลังเตรียมจัดส่ง">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              ผู้ขายต้องส่งภายใน{' '}
              <strong>{order.shipByISO ? fmtDateTime(order.shipByISO) : `${order.shipWithinDays ?? 2} วัน`}</strong>{' '}
              · เมื่อส่งแล้วคุณจะได้เลขพัสดุไว้ติดตาม
            </p>
            <AddressBlock order={order} />
          </Panel>
        )}

        {isBuyer && order.status === 'SHIPPED' && (
          <Panel icon={<Truck className="w-4 h-4 text-violet-600" />} title="ขนส่งกำลังนำส่ง">
            {trackingCard}
            <Button fullWidth leftIcon={<Camera className="w-4 h-4" />} onClick={() => router.push(`/orders/${order.id}/receive`)}>
              ได้รับของแล้ว · ถ่ายรูปยืนยัน
            </Button>
            <p className="text-[10px] text-slate-400 text-center">ถ่ายรูปหนังสือที่ได้รับ + ให้คะแนน แล้วระบบจะโอนเงินให้ผู้ขาย</p>
          </Panel>
        )}

        {isBuyer && order.status === 'COMPLETED' && (
          <Panel icon={<Star className="w-4 h-4 text-amber-500" />} title={order.review ? 'รีวิวของคุณ' : 'ให้คะแนนหนังสือเล่มนี้'}>
            {order.review ? (
              <ReviewBlock order={order} />
            ) : (
              <>
                <p className="text-[11px] text-slate-500">สภาพหนังสือตรงเกรดไหม ผู้ขายมาตรงเวลาไหม · รีวิวช่วยผู้ซื้อคนอื่น</p>
                <Button fullWidth onClick={() => router.push(`/orders/${order.id}/review`)}>
                  ให้คะแนนและรีวิว
                </Button>
              </>
            )}
          </Panel>
        )}

        {/* ================= SELLER ================= */}
        {!isBuyer && order.status === 'REQUESTED' && (
          <Panel icon={<Hourglass className="w-4 h-4 text-amber-600" />} title="ตอบรับคำขอนี้?">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <InfoTile label="ผู้ซื้อเลือก" value={order.delivery === 'MEETUP' ? 'นัดรับ' : 'ส่งพัสดุ'} />
              <InfoTile label="ค่าส่ง (ระบบคำนวณ)" value={order.shippingFee ? `฿${order.shippingFee}` : 'ไม่มี'} />
            </div>
            {order.delivery === 'MEETUP' && order.schedule ? (
              meetupCard
            ) : (
              <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                ส่งภายใน {order.shipWithinDays ?? 2} วันหลังผู้ซื้อชำระเงิน · ที่อยู่จัดส่งจะแสดงหลังชำระเงิน
              </p>
            )}
            <p className="flex items-start gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500">
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              ระบบซ่อนตัวตนผู้ซื้อ เพื่อป้องกันการนัดซื้อขายนอกแอป
            </p>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-amber-500" />รับออเดอร์ใช้ 1 เครดิต</span>
              <span>คงเหลือ <strong className="text-slate-800">{credits}</strong> เครดิต</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(true)}>ปฏิเสธ</Button>
              <Button onClick={() => (credits < 1 ? router.push('/seller/credits') : setAcceptOpen(true))}>
                {credits < 1 ? 'เติมเครดิต' : 'รับออเดอร์'}
              </Button>
            </div>
          </Panel>
        )}

        {!isBuyer && order.status === 'SCHEDULED' && (
          <>
            <Panel icon={<ScanLine className="w-4 h-4 text-teal-700" />} title="ปิดการขายด้วย QR ผู้ซื้อ">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ให้ผู้ซื้อตรวจหนังสือและจ่ายเงินก่อน แล้วสแกน QR บนมือถือของผู้ซื้อเพื่อยืนยันว่าส่งมอบแล้ว
              </p>
              <Button fullWidth leftIcon={<ScanLine className="w-4 h-4" />} onClick={() => setScanOpen(true)}>
                สแกน QR ผู้ซื้อ
              </Button>
              <button
                type="button"
                onClick={() => router.push(`/orders/${order.id}/no-show?role=seller`)}
                className="w-full text-[11px] font-semibold text-amber-700 hover:underline"
              >
                ผู้ซื้อไม่มาตามนัด?
              </button>
            </Panel>
            <Panel icon={<MapPin className="w-4 h-4 text-teal-600" />} title="รายละเอียดการนัดรับ">
              {meetupCard}
            </Panel>
          </>
        )}

        {!isBuyer && order.status === 'ACCEPTED' && order.delivery === 'PARCEL' && (
          <Panel icon={<Wallet className="w-4 h-4 text-sky-600" />} title="รอผู้ซื้อชำระเงิน">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              เมื่อผู้ซื้อแนบสลิปและระบบตรวจผ่าน จะเห็นที่อยู่จัดส่งและเริ่มนับเวลาส่ง {order.shipWithinDays ?? 2} วัน
            </p>
            <SlipRow order={order} onOpen={() => setSlipOpen(true)} />
          </Panel>
        )}

        {!isBuyer && order.status === 'PAID' && (
          <Panel icon={<Package className="w-4 h-4 text-sky-600" />} title="จัดส่งหนังสือ">
            <SlipRow order={order} onOpen={() => setSlipOpen(true)} />
            <p className="flex items-center gap-1.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              ต้องส่งภายใน {order.shipByISO ? fmtDateTime(order.shipByISO) : `${order.shipWithinDays ?? 2} วัน`}
            </p>
            <AddressBlock order={order} />
            <div className="space-y-2 pt-1">
              <span className="text-xs font-bold text-slate-700">ส่งแล้ว? ใส่เลขพัสดุ</span>
              <div className="flex flex-wrap gap-1.5">
                {CARRIERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCarrier(c)}
                    aria-pressed={carrier === c}
                    className={clsx(
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border',
                      carrier === c ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-600'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                placeholder="เลขพัสดุ เช่น TH0123456789"
                aria-label="เลขพัสดุ"
                className="w-full min-h-[46px] px-3 rounded-xl border border-slate-200 font-mono text-sm uppercase focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
              <Button fullWidth leftIcon={<Truck className="w-4 h-4" />} onClick={handleShip}>
                ยืนยันการจัดส่ง
              </Button>
            </div>
          </Panel>
        )}

        {!isBuyer && order.status === 'SHIPPED' && (
          <Panel icon={<Truck className="w-4 h-4 text-violet-600" />} title="รอผู้ซื้อยืนยันรับของ">
            {trackingCard}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              เมื่อผู้ซื้อถ่ายรูปยืนยันรับของ ระบบจะโอนเงินให้คุณทันที · ครบ 7 วันปิดให้อัตโนมัติ
            </p>
          </Panel>
        )}

        {!isBuyer && order.status === 'COMPLETED' && (
          <Panel icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} title="ปิดการขายแล้ว">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
              <span className="inline-flex items-center gap-1.5 font-bold"><Wallet className="w-4 h-4" />ได้รับเงินแล้ว</span>
              <span className="font-black text-sm">฿{order.amount.toLocaleString()}</span>
            </div>
            {order.receivedPhoto && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-600">รูปที่ผู้ซื้อถ่ายตอนได้รับของ</span>
                <img src={order.receivedPhoto} alt="รูปยืนยันรับของ" className="w-full h-44 object-cover rounded-xl bg-slate-100" />
              </div>
            )}
            {order.review ? <ReviewBlock order={order} /> : <p className="text-[11px] text-slate-400">ผู้ซื้อยังไม่ได้รีวิว</p>}
          </Panel>
        )}

        {/* Books */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-500">หนังสือในออเดอร์ ({order.books.length})</h2>
          {order.books.map((book) => (
            <div key={book.id} className="flex items-center gap-3">
              <img src={book.cover} alt={book.title} className="w-11 h-15 rounded-lg object-cover bg-slate-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">{book.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{GRADE_LABEL[book.grade] ?? book.grade}</p>
              </div>
              <span className="text-xs font-bold text-slate-900">฿{book.price.toLocaleString()}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
            <Row label="ค่าหนังสือ" value={`฿${order.amount.toLocaleString()}`} />
            <Row label="ค่าส่ง" value={order.shippingFee ? `฿${order.shippingFee}` : 'ฟรี (นัดรับ)'} />
            <div className="flex justify-between font-bold text-slate-900 pt-1">
              <span>รวม</span>
              <span>฿{order.total.toLocaleString()}</span>
            </div>
          </div>
        </section>

        {/* Chat */}
        <ChatRoom
          messages={chatOpen ? messagesFor(order.id) : []}
          role={role}
          status={order.status}
          otherName={otherName}
          otherAvatar={isBuyer ? order.shop.avatar : undefined}
          orderLabel={order.id}
          onSend={(text) => sendMessage(order.id, role, text)}
        />

        {['SCHEDULED', 'ACCEPTED', 'PAID', 'SHIPPED'].includes(order.status) && (
          <button
            type="button"
            onClick={() => setDisputeOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-200 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
          >
            <Flag className="w-3.5 h-3.5" />
            แจ้งปัญหาออเดอร์นี้
          </button>
        )}
      </div>

      {/* Buyer QR full screen */}
      {qrOpen && order.handoverCode && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="QR รับของ">
          <div className="w-full max-w-[340px] bg-white rounded-3xl p-6 text-center space-y-4 animate-pop">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">ออเดอร์ #{order.id}</span>
              <button type="button" onClick={() => setQrOpen(false)} aria-label="ปิด" className="p-1.5 rounded-full hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">ให้ผู้ขายสแกน QR นี้</h2>
            <div className="mx-auto w-fit p-3 rounded-2xl border-4 border-[var(--color-primary)]">
              <MockQr value={order.handoverCode} size={210} />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              สแกนแล้วออเดอร์ปิดทันที · เปิดเฉพาะเมื่อได้รับหนังสือและจ่ายเงินแล้ว
            </p>
          </div>
        </div>
      )}

      {/* Slip viewer */}
      {slipOpen && order.slipImage && (
        <button
          type="button"
          onClick={() => setSlipOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/85 flex items-center justify-center p-6"
          aria-label="ปิดสลิป"
        >
          <img src={order.slipImage} alt="สลิปการโอน" className="max-h-[80vh] rounded-2xl shadow-2xl" />
        </button>
      )}

      <CameraCapture
        isOpen={scanOpen}
        mode="SCAN"
        title="สแกน QR ผู้ซื้อ"
        hint="เล็ง QR บนมือถือผู้ซื้อให้อยู่ในกรอบ"
        onClose={() => setScanOpen(false)}
        onScan={() => {
          const ok = verifyHandover(order.id, order.handoverCode ?? '');
          setScanOpen(false);
          setToast(ok ? 'สแกนสำเร็จ · ปิดการขายแล้ว' : 'QR ไม่ถูกต้อง ลองอีกครั้ง');
        }}
      />

      <ConfirmSheet
        isOpen={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title="รับออเดอร์นี้?"
        description={`ใช้ 1 เครดิต (เหลือ ${Math.max(0, credits - 1)}) · หนังสือจะถูกล็อก คำขออื่นของเล่มนี้ถูกปฏิเสธอัตโนมัติ`}
        confirmLabel="ใช้ 1 เครดิตและรับออเดอร์"
        onConfirm={handleAccept}
      />
      <ConfirmSheet
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="ปฏิเสธคำขอนี้?"
        description="ไม่เสียเครดิต · หนังสือยังวางขายต่อ"
        confirmLabel="ปฏิเสธคำขอ"
        tone="danger"
        onConfirm={() => {
          rejectOrder(order.id);
          setRejectOpen(false);
          setToast('ปฏิเสธคำขอแล้ว');
        }}
      />
      <ConfirmSheet
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="ยกเลิกคำขอซื้อ?"
        description="คำขอจะถูกยกเลิก · หนังสือยังวางขายให้คนอื่นขอได้"
        confirmLabel="ยกเลิกคำขอ"
        tone="danger"
        onConfirm={() => {
          cancelOrder(order.id);
          setCancelOpen(false);
          setToast('ยกเลิกคำขอแล้ว');
        }}
      />
      <ConfirmSheet
        isOpen={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        title="แจ้งปัญหาออเดอร์"
        description="เลือกเหตุผลที่ใกล้ที่สุด · แอดมินจะเห็นแชทและรูปทั้งหมด"
        confirmLabel="ปิด"
        onConfirm={() => setDisputeOpen(false)}
      >
        <div className="space-y-2">
          {(isBuyer
            ? ['หนังสือไม่ตรงเกรด', 'ผู้ขายไม่ส่งของ', 'ของเสียหายระหว่างส่ง', 'ผู้ขายชวนติดต่อนอกแอป']
            : ['ผู้ซื้อไม่มาตามนัด', 'ผู้ซื้อไม่ชำระเงิน', 'ผู้ซื้อชวนติดต่อนอกแอป']
          ).map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                openDispute(order.id, reason, role);
                setDisputeOpen(false);
                setToast('ส่งเรื่องให้แอดมินแล้ว');
              }}
              className="w-full text-left p-3 rounded-xl border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              {reason}
            </button>
          ))}
          <p className="flex items-start gap-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            การแจ้งปัญหาจะหยุดเวลาทุกอย่างจนกว่าแอดมินจะสรุป
          </p>
        </div>
      </ConfirmSheet>

      <Toast isOpen={!!toast} onClose={() => setToast(null)} message={toast || ''} />
    </div>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-500">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}

function AddressBlock({ order }: { order: V4Order }) {
  if (!order.shipping?.receiverName) return null;
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
      <p className="font-bold text-slate-800 flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" />
        ส่งถึง {order.shipping.receiverName}
      </p>
      {order.shipping.receiverAddress && <p className="leading-snug">{order.shipping.receiverAddress}</p>}
      <p className="text-[10px] text-slate-400">ไม่มีเบอร์โทรให้อีกฝ่ายเห็น · ติดต่อผ่านแชทในออเดอร์</p>
    </div>
  );
}

function SlipRow({ order, onOpen }: { order: V4Order; onOpen: () => void }) {
  if (!order.slipImage) {
    return (
      <p className="p-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 text-center">
        ยังไม่มีสลิป
      </p>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left">
      <img src={order.slipImage} alt="สลิป" className="w-12 h-16 rounded-lg object-cover bg-slate-100" />
      <div className="flex-1 text-[11px]">
        <p className="font-bold text-slate-800">สลิปการชำระเงิน</p>
        <p className="text-emerald-700">ตรวจผ่านแล้ว · ระบบพักเงินไว้ ฿{order.total.toLocaleString()}</p>
      </div>
      <span className="text-[11px] font-semibold text-[var(--color-primary-dark)]">ดูสลิป</span>
    </button>
  );
}

function ReviewBlock({ order }: { order: V4Order }) {
  const review = order.review!;
  return (
    <div className="p-3 rounded-xl border border-slate-200 space-y-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={clsx('w-4 h-4', n <= review.rating ? 'fill-amber-400 stroke-amber-400' : 'stroke-slate-300')} />
        ))}
        <span className="ml-1.5 text-[11px] font-semibold text-slate-600">{review.rating}/5</span>
      </div>
      <p className={clsx('text-[11px] font-semibold', review.isGradeMatched ? 'text-emerald-700' : 'text-amber-700')}>
        {review.isGradeMatched ? '✓ สภาพตรงเกรด' : '⚠ สภาพไม่ตรงเกรด'}
      </p>
      {review.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {review.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{tag}</span>
          ))}
        </div>
      )}
      {review.comment && <p className="text-xs text-slate-700 leading-relaxed">“{review.comment}”</p>}
    </div>
  );
}
