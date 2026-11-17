'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import {
  StatusBadgeV4,
  ChatRoom,
  ConfirmSheet,
  OrderSteps,
  HandoverCode,
  CodeInput,
  LineOaBanner,
} from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import { useSeller } from '@/hooks/useSeller';
import { useLiff } from '@/hooks/useLiff';
import { STATUS_META, getTimerInfo, isTerminal } from '@/lib/orderStateMachine';
import { formatThaiDate, mapDirectionsUrl, mapEmbedUrl } from '@/lib/delivery';
import { V4Order, ViewRole } from '@/types/v4';
import {
  Clock,
  CalendarDays,
  MapPin,
  Truck,
  Star,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Hourglass,
  Copy,
  Package,
  Camera,
  ShieldCheck,
  Coins,
} from 'lucide-react';

const GRADE_LABEL: Record<string, string> = {
  LIKE_NEW: 'เหมือนใหม่',
  GENTLY_READ: 'คุณภาพดีมาก',
  WELL_LOVED: 'อ่านทั่วไป',
  WORN_BUT_READABLE: 'เน้นอ่าน',
};

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

const buyerAlias = (order: V4Order) => `ผู้ซื้อ #${order.id.slice(-4)}`;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    getOrder,
    loading,
    fetchOrder,
    fetchMessages,
    messagesFor,
    sendMessage,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    verifyHandover,
    openDispute,
    isMineAsBuyer,
  } = useV4Orders();
  const { credits } = useSeller();
  const { isReady, idToken } = useLiff();
  const [fetchingDetail, setFetchingDetail] = useState(true);

  const order = getOrder(id);
  const orderStatus = order?.status;
  const chatOpen = !!orderStatus && !['REQUESTED', 'REJECTED', 'EXPIRED'].includes(orderStatus);

  useEffect(() => {
    if (!isReady) return;
    if (!idToken) {
      setFetchingDetail(false);
      return;
    }
    let active = true;
    setFetchingDetail(true);
    fetchOrder(id).finally(() => {
      if (active) setFetchingDetail(false);
    });
    return () => {
      active = false;
    };
  }, [id, isReady, idToken, fetchOrder]);

  useEffect(() => {
    if (!orderStatus || !chatOpen) return;
    fetchMessages(id);
    if (isTerminal(orderStatus)) return;
    const timer = setInterval(() => {
      fetchMessages(id);
      fetchOrder(id);
    }, 8000);
    return () => clearInterval(timer);
  }, [id, orderStatus, chatOpen, fetchMessages, fetchOrder]);

  const [toast, setToast] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [handoverCodeInput, setHandoverCodeInput] = useState('');
  const [verifyingHandover, setVerifyingHandover] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  if (!order) {
    const isInitialLoading = !isReady || loading || fetchingDetail;
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ออเดอร์" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">
          {isInitialLoading
            ? 'กำลังโหลดข้อมูลออเดอร์...'
            : 'ไม่พบออเดอร์นี้ · อาจถูกลบหรือลิงก์ไม่ถูกต้อง'}
        </p>
      </div>
    );
  }

  const role: ViewRole = isMineAsBuyer(order) ? 'BUYER' : 'SELLER';
  const isBuyer = role === 'BUYER';
  const meta = STATUS_META[order.status];
  const timer = getTimerInfo(order);
  const otherName = isBuyer ? order.shop.shopName : buyerAlias(order);

  const headline = (() => {
    const s = order.status;
    if (s === 'REQUESTED') return isBuyer ? 'รอผู้ขายตอบรับคำขอ' : 'มีคำขอซื้อใหม่ · ตอบรับเพื่อเริ่มขาย';
    if (s === 'SCHEDULED') return isBuyer ? 'นัดรับแล้ว · จ่ายเงินสดหน้างานและแสดงรหัส 6 หลัก' : 'นัดรับแล้ว · เก็บเงินสดและกรอกรหัส 6 หลัก';
    if (s === 'ACCEPTED') return isBuyer ? 'ผู้ขายรับคำขอแล้ว · รอยืนยันการส่ง' : 'ยืนยันการส่งหนังสือ';
    if (s === 'PAID') return isBuyer ? 'ชำระเงินแล้ว · รอผู้ขายจัดส่งพัสดุ' : 'ผู้ซื้อชำระเงินแล้ว · รอผู้ขายจัดส่ง';
    if (s === 'SHIPPED') return isBuyer ? 'ผู้ขายจัดส่งแล้ว · รอรับของ' : 'จัดส่งแล้ว · รอผู้ซื้อยืนยันรับของ';
    if (s === 'COMPLETED') return isBuyer ? 'ได้รับหนังสือแล้ว' : 'ปิดการขายสำเร็จ';
    return meta.label;
  })();

  const handleAccept = async () => {
    const result = await acceptOrder(order.id);
    setAcceptOpen(false);
    setToast(result.ok ? 'รับออเดอร์แล้ว · ใช้ 1 เครดิต แชทเปิดแล้ว' : result.error || 'รับออเดอร์ไม่สำเร็จ');
  };

  const handleVerifyHandover = async () => {
    if (handoverCodeInput.trim().length !== 6) {
      setHandoverError('กรุณากรอกรหัสส่งมอบ 6 หลักให้ครบถ้วน');
      return;
    }
    setHandoverError(null);
    setVerifyingHandover(true);
    const result = await verifyHandover(order.id, handoverCodeInput.trim());
    setVerifyingHandover(false);
    if (!result.ok) {
      setHandoverError(result.error || 'รหัสส่งมอบ 6 หลักไม่ถูกต้อง');
      return;
    }
    setHandoverCodeInput('');
    setToast('ยืนยันรหัสส่งมอบสำเร็จ · ปิดการขายเรียบร้อยแล้ว');
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
        <LineOaBanner />
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
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 leading-relaxed">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>
                สถานที่และเวลารับหนังสือจะแสดงหลังผู้ขายยืนยันคำขอ
                (ผู้ขายใช้ 1 เครดิตเพื่อยืนยัน)
              </span>
            </div>
            <button type="button" onClick={() => setCancelOpen(true)} className="w-full text-[11px] font-medium text-slate-400 hover:text-rose-500 pt-1">
              ยกเลิกคำขอนี้
            </button>
          </Panel>
        )}

        {isBuyer && order.status === 'SCHEDULED' && (
          <>
            {order.handoverCode && <HandoverCode code={order.handoverCode} />}
            <Panel icon={<Package className="w-4 h-4 text-emerald-700" />} title="จ่ายเงินสดเมื่อรับหนังสือ">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ตรวจหนังสือให้ตรงเกรด แล้วจ่ายเงินสดให้ผู้ขายหน้างาน จากนั้นแสดงรหัส 6 หลักด้านบนให้ผู้ขายกรอกเพื่อปิดออเดอร์
              </p>
              <p className="text-xs font-bold text-slate-800">
                ยอดที่ต้องจ่าย ฿{order.total.toLocaleString()}
              </p>
            </Panel>
            <Panel icon={<MapPin className="w-4 h-4 text-teal-600" />} title="รายละเอียดการนัดรับ">
              {meetupCard}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ล็อกนัดหมายแล้ว · ไม่สามารถเปลี่ยนวันเวลาหรือสถานที่ได้ (หากไม่สะดวก กรุณาคุยในแชทหรือยกเลิกออเดอร์)
              </p>
            </Panel>
          </>
        )}

        {isBuyer && order.status === 'ACCEPTED' && order.delivery === 'MEETUP' && (
          <Panel icon={<CalendarDays className="w-4 h-4 text-teal-600" />} title="ยืนยันวันและจุดนัดรับ">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ผู้ขายรับออเดอร์แล้ว · ยืนยันหรือปรับเปลี่ยนวันเวลาและจุดนัดรับ เพื่อให้ระบบสร้างรหัสยืนยันส่งมอบ
            </p>
            {meetupCard}
            <Button fullWidth onClick={() => router.push(`/orders/${order.id}/schedule`)}>
              จัดการเวลานัดรับ / ยืนยันนัดหมาย
            </Button>
          </Panel>
        )}

        {isBuyer && order.status === 'ACCEPTED' && order.delivery === 'PARCEL' && (
          <Panel icon={<Hourglass className="w-4 h-4 text-sky-600" />} title="รอผู้ขายยืนยันการส่ง">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ผู้ขายกำลังเตรียมหนังสือและจัดส่ง · จ่ายเงินสดตอนรับพัสดุ
              · ระบบไม่มีการโอนเงินออนไลน์
            </p>
          </Panel>
        )}

        {isBuyer && order.status === 'PAID' && (
          <Panel icon={<Hourglass className="w-4 h-4 text-sky-600" />} title="ชำระเงินแล้ว · รอผู้ขายจัดส่ง">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ตรวจสอบการชำระเงินเรียบร้อยแล้ว · รอผู้ขายแพ็กหนังสือและแจ้งเลขติดตามพัสดุ
            </p>
          </Panel>
        )}

        {isBuyer && order.status === 'SHIPPED' && (
          <Panel icon={<Truck className="w-4 h-4 text-violet-600" />} title="รอรับของ · จ่ายเงินปลายทาง">
            {trackingCard}
            <Button fullWidth leftIcon={<Camera className="w-4 h-4" />} onClick={() => router.push(`/orders/${order.id}/receive`)}>
              ได้รับของแล้ว · ถ่ายรูปยืนยัน
            </Button>
            <p className="text-[10px] text-slate-400 text-center">
              จ่ายเงินสดให้ผู้ขาย/ขนส่งเมื่อรับของ แล้วถ่ายรูปและให้คะแนน
            </p>
          </Panel>
        )}

        {order.status === 'DISPUTED' && (
          <Panel icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} title="อยู่ระหว่างตรวจสอบข้อพิพาท">
            <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line">
              {order.dispute?.reason || 'อยู่ระหว่างการตรวจสอบจากทีมงานแอดมิน · เวลาทั้งหมดของออเดอร์ถูกหยุดชั่วคราว'}
            </p>
            {isBuyer && (order.missedMeetingReportedAtISO || order.delivery === 'MEETUP') && (
              <Button fullWidth onClick={() => router.push(`/orders/${order.id}/no-show`)}>
                ชี้แจง / โต้แย้งรายงานไม่มาตามนัด
              </Button>
            )}
          </Panel>
        )}

        {isBuyer && order.status === 'COMPLETED' && (
          <Panel icon={<Star className="w-4 h-4 text-amber-500" />} title={order.review ? 'รีวิวของคุณ' : 'ให้คะแนนหนังสือเล่มนี้'}>
            {order.review ? (
              <ReviewBlock order={order} />
            ) : (
              <>
                <p className="text-[11px] text-slate-500">คุณภาพหนังสือตรงเกรดไหม ผู้ขายมาตรงเวลาไหม · รีวิวช่วยผู้ซื้อคนอื่น</p>
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
              <InfoTile label="ค่าส่งพัสดุ" value={order.shippingFee ? `฿${order.shippingFee}` : 'ไม่มี'} />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 leading-relaxed">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <span>
                สถานที่และเวลารับหนังสือจะแสดงหลังกดรับออเดอร์
                (ใช้ 1 เครดิต) · ตรวจสอบก่อนตัดสินใจได้จากประเภทการรับ
              </span>
            </div>
            <p className="flex items-start gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
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
            <Panel icon={<Package className="w-4 h-4 text-teal-700" />} title="เก็บเงินสดและกรอกรหัสส่งมอบ 6 หลัก">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ให้ผู้ซื้อตรวจหนังสือและจ่ายเงินสดหน้างาน จากนั้นขอรหัส 6 หลักจากหน้าจอผู้ซื้อมากรอกเพื่อปิดการขาย
              </p>
              <CodeInput
                value={handoverCodeInput}
                onChange={(next) => {
                  setHandoverCodeInput(next);
                  setHandoverError(null);
                }}
                onSubmit={handleVerifyHandover}
                isLoading={verifyingHandover}
                error={handoverError || undefined}
              />
              <button
                type="button"
                onClick={() => router.push(`/orders/${order.id}/no-show`)}
                className="w-full text-[11px] font-semibold text-amber-700 hover:underline pt-1"
              >
                ผู้ซื้อไม่มาตามนัด?
              </button>
            </Panel>
            <Panel icon={<MapPin className="w-4 h-4 text-teal-600" />} title="รายละเอียดการนัดรับ">
              {meetupCard}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ล็อกนัดหมายแล้ว · ไม่สามารถเปลี่ยนวันเวลาหรือสถานที่ได้ (หากไม่สะดวก กรุณาคุยในแชทหรือยกเลิกออเดอร์)
              </p>
            </Panel>
          </>
        )}

        {!isBuyer && order.status === 'ACCEPTED' && order.delivery === 'MEETUP' && (
          <Panel icon={<CalendarDays className="w-4 h-4 text-teal-600" />} title="กำหนด / ยืนยันเวลานัดรับ">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              ออเดอร์นี้เป็นแบบนัดรับ · กดยืนยันหรือเสนอเวลานัดหมายใหม่กับผู้ซื้อก่อนเจอกัน (จ่ายเงินสดหน้างาน)
            </p>
            {meetupCard}
            <Button fullWidth onClick={() => router.push(`/orders/${order.id}/schedule`)}>
              กำหนด / ยืนยันนัดหมาย
            </Button>
          </Panel>
        )}

        {!isBuyer && (order.status === 'ACCEPTED' || order.status === 'PAID') && order.delivery === 'PARCEL' && (
          <Panel icon={<Truck className="w-4 h-4 text-sky-600" />} title="ยืนยันการส่ง">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {order.status === 'PAID'
                ? 'ผู้ซื้อชำระเงินเรียบร้อยแล้ว · กรุณาจัดส่งพัสดุและกรอกเลขติดตามพัสดุ'
                : 'เตรียมหนังสือและจัดส่ง · ผู้ซื้อจ่ายเงินสดตอนรับพัสดุ'}
            </p>
            <AddressBlock order={order} />
            <Button fullWidth onClick={() => router.push(`/orders/${order.id}/tracking`)}>
              ยืนยันการส่งและใส่เลขพัสดุ
            </Button>
          </Panel>
        )}

        {!isBuyer && order.status === 'SHIPPED' && (
          <Panel icon={<Package className="w-4 h-4 text-violet-600" />} title="ส่งแล้ว · รอผู้ซื้อรับของ">
            {trackingCard}
            <p className="text-[11px] text-slate-500 leading-relaxed">
              จัดส่งพัสดุแล้ว · รอผู้ซื้อได้รับหนังสือและกดยืนยันรับของ
            </p>
          </Panel>
        )}

        {!isBuyer && order.status === 'COMPLETED' && (
          <Panel icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} title="ปิดการขายแล้ว">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900">
              <span className="inline-flex items-center gap-1.5 font-bold"><Coins className="w-4 h-4" />เก็บเงินปลายทางแล้ว</span>
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
          onSend={async (text) => {
            const res = await sendMessage(order.id, role, text);
            if (!res.ok) setToast(res.error || 'ส่งข้อความไม่สำเร็จ');
          }}
        />

        {['ACCEPTED', 'SCHEDULED'].includes(order.status) && (
          <button
            type="button"
            onClick={() => {
              setCancelReason('');
              setCancelOpen(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 p-3 rounded-2xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            ยกเลิกออเดอร์นี้
          </button>
        )}

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
        onConfirm={async () => {
          const res = await rejectOrder(order.id);
          setRejectOpen(false);
          setToast(res.ok ? 'ปฏิเสธคำขอแล้ว' : res.error || 'ปฏิเสธไม่สำเร็จ');
        }}
      />
      <ConfirmSheet
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={order.status === 'REQUESTED' ? 'ยกเลิกคำขอซื้อ?' : 'ยกเลิกออเดอร์นี้?'}
        description={
          order.status === 'REQUESTED'
            ? 'คำขอจะถูกยกเลิก · หนังสือยังวางขายให้คนอื่นขอได้'
            : isBuyer
              ? 'หนังสือจะกลับไปวางขายต่อ และระบบจะคืน 1 เครดิตให้ผู้ขาย'
              : 'หนังสือจะกลับไปวางขายต่อ · ผู้ขายยกเลิกหลังรับออเดอร์จะไม่ได้รับเครดิตคืน'
        }
        confirmLabel="ยืนยันยกเลิก"
        tone="danger"
        onConfirm={() => {
          const reasonToSend =
            cancelReason.trim() ||
            (order.status === 'REQUESTED' ? 'ผู้ซื้อยกเลิกคำขอ' : '');
          if (!reasonToSend) {
            setToast('กรุณาระบุเหตุผลการยกเลิกก่อน');
            return;
          }
          setCancelReason(reasonToSend);
          setCancelOpen(false);
          setCancelConfirmOpen(true);
        }}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {(order.status === 'REQUESTED'
              ? ['เปลี่ยนใจ / เลือกเล่มอื่นแล้ว', 'ส่งคำขอผิดรายการ']
              : isBuyer
                ? ['ตกลงวันเวลาไม่ตรงกัน', 'เปลี่ยนใจ / ไม่สะดวกนัดรับ']
                : ['ตกลงวันเวลาไม่ตรงกัน', 'หนังสือชำรุด / ไม่พร้อมส่ง']
            ).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCancelReason(preset)}
                className={clsx(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium border transition',
                  cancelReason === preset
                    ? 'bg-rose-50 border-rose-400 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            maxLength={150}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="ระบุเหตุผลการยกเลิก..."
            className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-rose-400"
          />
          {order.status !== 'REQUESTED' && !isBuyer && (
            <p className="flex items-start gap-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              คำเตือน: หากผู้ขายเป็นฝ่ายยกเลิกหลังรับออเดอร์ ระบบจะไม่คืน 1 เครดิตที่ถูกหักไปแล้ว
            </p>
          )}
        </div>
      </ConfirmSheet>
      <ConfirmSheet
        isOpen={cancelConfirmOpen}
        onClose={() => {
          if (cancelSubmitting) return;
          setCancelConfirmOpen(false);
          setCancelOpen(true);
        }}
        title="ยืนยันอีกครั้งก่อนยกเลิก?"
        description={
          order.status === 'REQUESTED'
            ? 'คำขอนี้จะถูกยกเลิกถาวร · ไม่สามารถกู้คืนได้'
            : isBuyer
              ? 'ออเดอร์จะถูกยกเลิกถาวร · หนังสือกลับไปวางขายต่อ และคืน 1 เครดิตให้ผู้ขาย'
              : 'ออเดอร์จะถูกยกเลิกถาวร · หนังสือกลับไปวางขายต่อ และคุณจะไม่ได้รับเครดิตคืน'
        }
        confirmLabel="ยกเลิกออเดอร์ทันที"
        cancelLabel="ย้อนกลับ"
        tone="danger"
        isLoading={cancelSubmitting}
        onConfirm={async () => {
          if (cancelSubmitting) return;
          setCancelSubmitting(true);
          const res = await cancelOrder(
            order.id,
            cancelReason.trim() || 'ยกเลิกคำสั่งซื้อ'
          );
          setCancelSubmitting(false);
          setCancelConfirmOpen(false);
          setCancelReason('');
          setToast(res.ok ? 'ยกเลิกออเดอร์เรียบร้อยแล้ว' : res.error || 'ยกเลิกไม่สำเร็จ');
        }}
      >
        <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
          เหตุผล: <span className="font-semibold text-slate-800">{cancelReason}</span>
        </p>
      </ConfirmSheet>
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
              onClick={async () => {
                const res = await openDispute(order.id, reason, role);
                setDisputeOpen(false);
                setToast(res.ok ? 'ส่งเรื่องให้แอดมินแล้ว' : res.error || 'ส่งเรื่องไม่สำเร็จ');
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
      <p className="text-[10px] text-slate-400">ติดต่อผ่านแชทในออเดอร์</p>
    </div>
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
        {review.isGradeMatched ? '✓ คุณภาพตรงเกรด' : '⚠ คุณภาพไม่ตรงเกรด'}
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
