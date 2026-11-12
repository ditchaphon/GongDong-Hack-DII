'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Button, Toast } from '@/components/ui';
import {
  StatusBadgeV4,
  OrderTimeline,
  NextActionCard,
  ChatRoom,
  HandoverCode,
  ConfirmSheet,
} from '@/components/v4';
import { useV4Orders } from '@/hooks/useV4Orders';
import {
  STATUS_META,
  getNextAction,
  getTimerInfo,
  isTerminal,
  ActionKey,
} from '@/lib/orderStateMachine';
import { ViewRole } from '@/types/v4';
import {
  Clock,
  MapPin,
  Truck,
  ShieldCheck,
  Star,
  Flag,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

const GRADE_LABEL: Record<string, string> = {
  LIKE_NEW: 'เหมือนใหม่',
  GENTLY_READ: 'อ่านทั่วไป',
  WELL_LOVED: 'เน้นอ่าน',
  WORN_BUT_READABLE: 'เน้นอ่าน',
};

export default function V4OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    getOrder,
    messagesFor,
    sendMessage,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    complete,
    openDispute,
  } = useV4Orders();

  const order = getOrder(resolvedParams.id);

  const [role, setRole] = useState<ViewRole>('BUYER');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [receivedOpen, setReceivedOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setRole(search.get('role') === 'seller' ? 'SELLER' : 'BUYER');
  }, []);

  if (!order) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="ออเดอร์" onBack={() => router.push('/orders')} />
        <p className="p-6 text-center text-xs text-slate-500">
          ไม่พบออเดอร์นี้ · อาจถูกลบหรือลิงก์ไม่ถูกต้อง
        </p>
      </div>
    );
  }

  const meta = STATUS_META[order.status];
  const action = getNextAction(order, role);
  const timer = getTimerInfo(order);
  const otherParty = role === 'BUYER' ? order.shop : order.buyer;
  const otherName =
    role === 'BUYER'
      ? order.shop.shopName
      : `${order.buyer.nickname} · ผู้ซื้อ`;
  const otherAvatar =
    role === 'BUYER' ? order.shop.avatar : order.buyer.avatar;

  const roleQuery = role === 'SELLER' ? '?role=seller' : '';

  const handleAction = (key: ActionKey) => {
    switch (key) {
      case 'RESPOND_REQUEST':
        setAcceptOpen(true);
        return;
      case 'CANCEL_REQUEST':
        setCancelOpen(true);
        return;
      case 'PROPOSE_MEETUP':
      case 'CONFIRM_MEETUP':
        router.push(`/orders/${order.id}/schedule${roleQuery}`);
        return;
      case 'PAY_ORDER':
        router.push(`/orders/${order.id}/pay`);
        return;
      case 'SHOW_HANDOVER_CODE':
      case 'ENTER_HANDOVER_CODE':
        router.push(`/orders/${order.id}/handover${roleQuery}`);
        return;
      case 'SHIP_PARCEL':
      case 'VIEW_TRACKING':
        router.push(`/orders/${order.id}/tracking${roleQuery}`);
        return;
      case 'CONFIRM_RECEIVED':
        setReceivedOpen(true);
        return;
      case 'REVIEW':
        router.push(`/orders/${order.id}/review`);
        return;
      case 'VIEW_DISPUTE':
        setToastMessage('แอดมินกำลังตรวจสอบ · เพิ่มข้อมูลได้ในแชทออเดอร์');
        return;
      default:
        setToastMessage(action.description);
    }
  };

  const handleAccept = () => {
    const result = acceptOrder(order.id);
    setAcceptOpen(false);
    if (!result.ok) {
      setToastMessage(result.error || 'รับออเดอร์ไม่สำเร็จ');
      return;
    }
    setToastMessage('รับออเดอร์แล้ว · คำขออื่นของเล่มนี้ถูกปฏิเสธอัตโนมัติ');
  };

  const handleReject = () => {
    rejectOrder(order.id);
    setRejectOpen(false);
    setToastMessage('ปฏิเสธคำขอแล้ว · ไม่เสียเครดิต');
  };

  const handleCancel = () => {
    cancelOrder(order.id);
    setCancelOpen(false);
    setToastMessage('ยกเลิกคำขอแล้ว · หนังสือกลับมาวางขายตามปกติ');
  };

  const handleReceived = () => {
    complete(order.id);
    setReceivedOpen(false);
    setToastMessage('ปิดออเดอร์แล้ว · ให้คะแนนร้านได้เลย');
  };

  const handleDispute = (reason: string) => {
    openDispute(order.id, reason, role);
    setDisputeOpen(false);
    setToastMessage('ส่งเรื่องให้แอดมินแล้ว · เวลาทั้งหมดหยุดชั่วคราว');
  };

  const showDisputeEntry =
    ['ACCEPTED', 'SCHEDULED', 'PAID', 'SHIPPED'].includes(order.status);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-32">
      <TopBar
        title={`ออเดอร์ #${order.id}`}
        onBack={() => router.push('/orders')}
      />

      <div className="p-4 space-y-4">
        {/* แบนเนอร์แจ้งเตือนสถานะ DISPUTED ชัดเจน */}
        {order.status === 'DISPUTED' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5 text-[11px] text-amber-900 shadow-sm">
            <div className="flex items-center gap-1.5 font-bold text-amber-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>อยู่ระหว่างการตรวจสอบข้อพิพาทโดยแอดมิน</span>
            </div>
            <p className="leading-relaxed">
              {order.dispute ? `เหตุผลที่แจ้ง: "${order.dispute.reason}"` : 'มีรายงานข้อพิพาทในออเดอร์นี้'} · ตัวนับเวลาทั้งหมดหยุดชั่วคราว สามารถส่งหลักฐานหรือชี้แจงเพิ่มเติมในแชทออเดอร์ด้านล่างได้
            </p>
          </div>
        )}

        {/* การ์ดเชิญชวนรีวิวเมื่อออเดอร์สำเร็จ */}
        {order.status === 'COMPLETED' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-900">
                <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                <span>{order.review ? `บันทึกรีวิวแล้ว (${order.review.rating} ดาว)` : 'ให้คะแนนและรีวิวออเดอร์นี้'}</span>
              </div>
              <p className="text-[10px] text-emerald-700">
                {order.review
                  ? `สภาพหนังสือ: ${order.review.isGradeMatched ? 'ตรงตามเกรด ✓' : 'ไม่ตรงตามเกรด ⚠️'}`
                  : 'ช่วยประเมินว่าสภาพหนังสือตรงตามเกรดที่แจ้งไว้หรือไม่'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/orders/${order.id}/review`)}
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition active:scale-95"
            >
              {order.review ? 'แก้ไขรีวิว' : 'เขียนรีวิว'}
            </button>
          </div>
        )}

        {/* Status + who acts + time left */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <StatusBadgeV4 status={order.status} />
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {meta.explanation}
              </p>
            </div>
            {timer && !isTerminal(order.status) && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
                  timer.expired
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                {timer.expired ? 'หมดเวลา' : `${timer.hoursLeft} ชม.`}
              </span>
            )}
          </div>

          <OrderTimeline order={order} />

          <NextActionCard order={order} role={role} onAction={handleAction} />
        </div>

        {/* Seller decision */}
        {role === 'SELLER' && order.status === 'REQUESTED' && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-slate-800">ตอบรับคำขอนี้?</h2>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              รับออเดอร์ใช้ 1 เครดิต และล็อกหนังสือเล่มนี้ ·
              คำขออื่นของเล่มเดียวกันจะถูกปฏิเสธอัตโนมัติ
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => setAcceptOpen(true)}>
                รับออเดอร์
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRejectOpen(true)}
              >
                ปฏิเสธ
              </Button>
            </div>
          </div>
        )}

        {/* Books */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            หนังสือในออเดอร์ ({order.books.length})
          </h2>
          {order.books.map((book) => (
            <div key={book.id} className="flex items-center gap-3">
              <img
                src={book.cover}
                alt={book.title}
                className="w-11 h-15 rounded-lg object-cover bg-slate-100 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">
                  {book.title}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  เกรด {GRADE_LABEL[book.grade] ?? book.grade}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-900">
                ฿{book.price.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>ค่าหนังสือ</span>
              <span>฿{order.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ค่าส่ง</span>
              <span>{order.shippingFee ? `฿${order.shippingFee}` : '฿0 (นัดรับ)'}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-1">
              <span>รวมทั้งสิ้น</span>
              <span>฿{order.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Other party */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          {otherAvatar ? (
            <img
              src={otherAvatar}
              alt={otherName}
              className="w-11 h-11 rounded-full object-cover bg-slate-100"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-100" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 truncate">{otherName}</h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center text-amber-500 font-semibold">
                <Star className="w-3 h-3 fill-amber-400 stroke-amber-400 mr-0.5" />
                {otherParty.rating}
              </span>
              <span>•</span>
              <span>
                {role === 'BUYER'
                  ? `ขายแล้ว ${order.shop.completedSales} ครั้ง`
                  : `ซื้อแล้ว ${order.buyer.completedOrders} ครั้ง`}
              </span>
              {role === 'SELLER' && order.buyer.noShows ? (
                <span className="text-rose-600">
                  • ไม่มารับ {order.buyer.noShows} ครั้ง
                </span>
              ) : null}
            </div>
          </div>
          {role === 'BUYER' && order.shop.payeeVerified && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              ยืนยันบัญชีแล้ว
            </span>
          )}
        </div>

        {/* Delivery / schedule / tracking */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {order.delivery === 'MEETUP' ? 'นัดรับ' : 'การจัดส่ง'}
          </h2>

          {order.delivery === 'MEETUP' && order.schedule ? (
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-[11px] text-teal-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                {order.schedule.landmark}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {order.schedule.dateISO} · {order.schedule.timeLabel}
              </div>
              <p className="text-teal-700">
                {order.schedule.confirmedByBuyer
                  ? 'ผู้ซื้อยืนยันนัดแล้ว · ตรวจหนังสือและจ่ายเงินหน้างาน'
                  : 'รอผู้ซื้อยืนยันนัด · ใช้แชทออเดอร์คุยรายละเอียด'}
              </p>
              {order.schedule.lat && order.schedule.lng && (
                <div className="pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${order.schedule.lat},${order.schedule.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold transition active:scale-95 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    เปิดนำทางใน Google Maps
                  </a>
                </div>
              )}
            </div>
          ) : order.delivery === 'PARCEL' ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <Truck className="w-3.5 h-3.5" />
                ผู้รับ: {order.shipping?.receiverName || 'รอผู้ซื้อกรอกที่อยู่'}
              </div>
              <p className="text-slate-500">
                ที่อยู่จัดส่งดูได้ในแบบฟอร์มจัดส่งของแอดมิน ·
                ไม่มีเบอร์โทรให้อีกฝ่ายเห็น
              </p>
              {order.shipping?.trackingNumber && (
                <p className="font-mono font-bold text-emerald-700">
                  {order.shipping.carrier} · {order.shipping.trackingNumber}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {order.delivery === 'MEETUP'
                ? 'ผู้ขายจะเสนอวันเวลาและจุดนัดในแชทออเดอร์'
                : 'รอผู้ซื้อชำระเงินด้วยคิวอาร์'}
            </p>
          )}

          {order.slipCheck !== 'NONE' && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              สถานะสลิป: <strong>{order.slipCheck}</strong>
            </div>
          )}

          {order.handoverCodeVerifiedAtISO && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700">
              <KeyRound className="w-3.5 h-3.5" />
              ยืนยันรหัสรับของแล้ว · ออเดอร์ปิดเรียบร้อย
            </div>
          )}
        </div>

        {/* Handover code (buyer, scheduled) */}
        {order.status === 'SCHEDULED' && role === 'BUYER' && order.handoverCode && (
          <HandoverCode
            code={order.handoverCode}
            onReveal={() =>
              setToastMessage('แสดงรหัสหลังตรวจหนังสือและจ่ายเงินแล้วเท่านั้น')
            }
          />
        )}

        {order.status === 'SCHEDULED' && role === 'SELLER' && (
          <div className="space-y-2">
            <Button
              fullWidth
              leftIcon={<KeyRound className="w-4 h-4" />}
              onClick={() => router.push(`/orders/${order.id}/handover?role=seller`)}
            >
              ใส่รหัสรับของจากผู้ซื้อ
            </Button>
            <button
              type="button"
              onClick={() => router.push(`/orders/${order.id}/no-show?role=seller`)}
              className="w-full text-[11px] font-semibold text-amber-700 hover:underline"
            >
              ผู้ซื้อไม่มาตามนัด?
            </button>
          </div>
        )}

        {/* Chat */}
        <ChatRoom
          messages={messagesFor(order.id)}
          role={role}
          status={order.status}
          otherName={otherName}
          otherAvatar={otherAvatar}
          orderLabel={order.id}
          onSend={(text) => {
            sendMessage(order.id, role, text);
            setToastMessage('ส่งข้อความแล้ว · ข้อมูลติดต่อถูกปิดอัตโนมัติ');
          }}
          onProposeSchedule={
            order.delivery === 'MEETUP' && order.status === 'ACCEPTED'
              ? () => router.push(`/orders/${order.id}/schedule${roleQuery}`)
              : undefined
          }
        />

        {showDisputeEntry && (
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-slate-700">
              <Flag className="w-4 h-4 text-rose-500 shrink-0" />
              <span>พบปัญหาหรือข้อพิพาทในออเดอร์นี้?</span>
            </div>
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold transition active:scale-95 shrink-0"
            >
              แจ้งปัญหาออเดอร์
            </button>
          </div>
        )}

        {role === 'BUYER' && order.status === 'REQUESTED' && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="w-full text-[11px] font-medium text-slate-400 hover:text-rose-500"
          >
            ยกเลิกคำขอนี้
          </button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg">
          <Button fullWidth size="lg" onClick={() => handleAction(action.key)}>
            {action.primaryLabel || 'รับทราบ'}
          </Button>
        </div>
      </div>

      <ConfirmSheet
        isOpen={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title="รับออเดอร์นี้?"
        description="ใช้ 1 เครดิต · หนังสือจะถูกล็อกและคำขออื่นของเล่มนี้ถูกปฏิเสธอัตโนมัติ"
        confirmLabel="ใช้ 1 เครดิตและรับออเดอร์"
        onConfirm={handleAccept}
      />

      <ConfirmSheet
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="ปฏิเสธคำขอนี้?"
        description="ไม่เสียเครดิต · ผู้ซื้อจะได้รับแจ้งและหนังสือยังวางขายต่อ"
        confirmLabel="ปฏิเสธคำขอ"
        tone="danger"
        onConfirm={handleReject}
      />

      <ConfirmSheet
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="ยกเลิกคำขอซื้อ?"
        description="คำขอจะถูกยกเลิก · หนังสือยังวางขายให้คนอื่นขอได้"
        confirmLabel="ยกเลิกคำขอ"
        tone="danger"
        onConfirm={handleCancel}
      />

      <ConfirmSheet
        isOpen={receivedOpen}
        onClose={() => setReceivedOpen(false)}
        title="ได้รับหนังสือแล้ว?"
        description="ตรวจสภาพตรงเกรดและจ่ายเงินเรียบร้อยแล้ว · ปิดออเดอร์และให้คะแนนร้าน"
        confirmLabel="ได้รับแล้ว"
        onConfirm={handleReceived}
      />

      <ConfirmSheet
        isOpen={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        title="แจ้งปัญหาออเดอร์"
        description="เลือกเหตุผลที่ใกล้ที่สุด · แอดมินจะเห็นแชท สลิป และรูปทั้งหมด"
        confirmLabel="ปิด"
        onConfirm={() => setDisputeOpen(false)}
      >
        <div className="space-y-2">
          {(role === 'SELLER'
            ? ['ผู้ซื้อไม่มาตามนัด', 'ผู้ซื้อไม่ชำระเงิน', 'ผู้ซื้อไม่ตอบข้อความ']
            : ['หนังสือไม่ตรงเกรด', 'ผู้ขายไม่ส่งของ', 'ของเสียหายระหว่างส่ง']
          ).map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => handleDispute(reason)}
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

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
