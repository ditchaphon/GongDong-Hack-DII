'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, EmptyState, Toast } from '@/components/ui';
import { ConfirmSheet } from '@/components/v4';
import { useLiff } from '@/hooks/useLiff';
import { api, ApiError } from '@/lib/api';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  UserX,
  XCircle,
} from 'lucide-react';

type AdminStatusTab = 'DISPUTED' | 'RESOLVED';

interface AdminOrderItem {
  id: string;
  status: string;
  shippingMethod: string;
  paymentMethod: string;
  totalPrice: number;
  shippingFee: number;
  cancelReason: string | null;
  receivedPhotoUrl: string | null;
  paymentSlipUrl: string | null;
  createdAt: string;
  updatedAt: string;
  dispute: {
    reason: string | null;
    openedBy: string | null;
    openedAt: string | null;
    missedMeetingReportedAt: string | null;
  };
  schedule: {
    locationName: string | null;
    dateIso: string | null;
    timeLabel: string | null;
    scheduledAt: string | null;
    confirmedByBuyer: boolean;
  } | null;
  buyer: {
    id: string;
    nickname: string | null;
    displayName: string;
    avatarUrl: string | null;
    noShowCount: number;
  };
  seller: {
    id: string;
    nickname: string | null;
    displayName: string;
    shopName: string | null;
    credits: number;
  };
  items: Array<{
    bookId: string;
    title: string;
    price: number;
    grade: string;
    coverImageUrl: string;
  }>;
  recentMessages: Array<{
    id: string;
    senderRole: string;
    senderName: string | null;
    kind: string;
    text: string;
    createdAt: string;
  }>;
}

interface ResolveFormState {
  orderId: string;
  resolution: 'COMPLETED' | 'CANCELLED';
  adminNote: string;
  refundCredit: boolean;
  incrementBuyerNoShow: boolean;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const { isReady, isLoggedIn, idToken, user, login } = useLiff();

  const [tab, setTab] = useState<AdminStatusTab>('DISPUTED');
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveForm, setResolveForm] = useState<ResolveFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadOrders = useCallback(
    async (activeTab: AdminStatusTab) => {
      if (!idToken || !user.isAdmin) return;
      setLoading(true);
      setLoadError(null);
      setForbiddenError(null);
      try {
        const res = await api.get<{ orders: AdminOrderItem[] }>(
          `/api/admin/orders?status=${activeTab}`,
          { token: idToken }
        );
        const list = Array.isArray(res.orders) ? res.orders : [];
        setOrders(list);
        if (list.length > 0 && !expandedId) {
          setExpandedId(list[0].id);
        }
      } catch (err) {
        if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
          setForbiddenError(err.message);
        } else {
          setLoadError(err instanceof Error ? err.message : 'โหลดข้อมูลข้อพิพาทไม่สำเร็จ');
        }
      } finally {
        setLoading(false);
      }
    },
    [idToken, user.isAdmin, expandedId]
  );

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken || !user.isAdmin) return;
    loadOrders(tab);
  }, [isReady, isLoggedIn, idToken, user.isAdmin, tab, loadOrders]);

  const handleResolveSubmit = async () => {
    if (!resolveForm || !idToken) return;
    if (!resolveForm.adminNote.trim()) {
      setToast('กรุณาระบุหมายเหตุการตัดสินของแอดมิน');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(
        `/api/admin/orders/${resolveForm.orderId}/resolve`,
        {
          resolution: resolveForm.resolution,
          adminNote: resolveForm.adminNote.trim(),
          refundCredit:
            resolveForm.resolution === 'CANCELLED' ? resolveForm.refundCredit : false,
          incrementBuyerNoShow:
            resolveForm.resolution === 'CANCELLED'
              ? resolveForm.incrementBuyerNoShow
              : false,
        },
        { token: idToken }
      );
      setToast(
        resolveForm.resolution === 'COMPLETED'
          ? 'ตัดสินปิดการขายสำเร็จแล้ว'
          : 'ตัดสินยกเลิกคำสั่งซื้อเรียบร้อยแล้ว'
      );
      setResolveForm(null);
      setExpandedId(null);
      await loadOrders(tab);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'บันทึกคำตัดสินไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="Admin · จัดการข้อพิพาท" onBack={() => router.push('/')} />
        <div className="p-4 space-y-3">
          <div className="h-24 rounded-2xl bg-slate-200 animate-pulse" />
          <div className="h-44 rounded-2xl bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !idToken) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="Admin · จัดการข้อพิพาท" onBack={() => router.push('/')} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 w-full text-center">
            <EmptyState
              icon={<ShieldAlert className="w-10 h-10 text-amber-500" />}
              title="กรุณาเข้าสู่ระบบผ่าน LINE"
              description="หน้านี้สงวนไว้สำหรับผู้ดูแลระบบที่ยืนยันตัวตนผ่าน LINE เท่านั้น"
              actionText="เข้าสู่ระบบ LINE"
              onAction={login}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user.isAdmin || forbiddenError) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <TopBar title="Admin · จัดการข้อพิพาท" onBack={() => router.push('/')} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-rose-200 p-6 w-full text-center space-y-4">
            <EmptyState
              icon={<ShieldAlert className="w-10 h-10 text-rose-500" />}
              title="ไม่มีสิทธิ์เข้าถึงหน้านี้ (403)"
              description={
                forbiddenError ||
                'บัญชี LINE นี้ไม่ได้รับสิทธิ์ผู้ดูแลระบบ (Admin)'
              }
              actionText="กลับหน้าหลัก"
              onAction={() => router.push('/')}
            />
            {user.lineUserId && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-1">
                <p className="text-[10px] font-bold text-slate-500">
                  LINE User ID ของคุณ (สำหรับผู้ดูแลระบบนำไปเพิ่มใน ADMIN_LINE_USER_IDS):
                </p>
                <p className="font-mono text-[11px] text-slate-800 break-all select-all">
                  {user.lineUserId}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-12">
      <TopBar
        title="Admin · จัดการข้อพิพาท"
        subtitle="ตรวจสอบหลักฐานและตัดสินเคส"
        onBack={() => router.push('/profile')}
        rightAction={
          <button
            type="button"
            onClick={() => loadOrders(tab)}
            disabled={loading}
            aria-label="รีเฟรช"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-full hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
          </button>
        }
      />

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-4 py-2.5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setTab('DISPUTED');
            setExpandedId(null);
          }}
          className={clsx(
            'min-h-[40px] rounded-xl text-xs font-bold border transition',
            tab === 'DISPUTED'
              ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          รอตรวจสอบ (DISPUTED)
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('RESOLVED');
            setExpandedId(null);
          }}
          className={clsx(
            'min-h-[40px] rounded-xl text-xs font-bold border transition',
            tab === 'RESOLVED'
              ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-xs'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          ตัดสินแล้ว
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading && orders.length === 0 ? (
          <div className="space-y-3">
            <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="h-32 rounded-2xl bg-slate-200 animate-pulse" />
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-rose-200 p-5">
            <EmptyState
              title="โหลดข้อมูลไม่สำเร็จ"
              description={loadError}
              actionText="ลองใหม่"
              onAction={() => loadOrders(tab)}
            />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <EmptyState
              icon={<ShieldCheck className="w-10 h-10 text-emerald-500" />}
              title={
                tab === 'DISPUTED'
                  ? 'ไม่มีคำสั่งซื้อที่รอตรวจสอบ'
                  : 'ยังไม่มีประวัติการตัดสินข้อพิพาท'
              }
              description={
                tab === 'DISPUTED'
                  ? 'เคสข้อพิพาททั้งหมดถูกจัดการเรียบร้อยแล้ว'
                  : 'เมื่อแอดมินตัดสินเคสแล้ว ประวัติจะแสดงที่นี่'
              }
            />
          </div>
        ) : (
          orders.map((order) => {
            const expanded = expandedId === order.id;
            const buyerName = order.buyer.nickname || order.buyer.displayName;
            const sellerName =
              order.seller.shopName || order.seller.nickname || order.seller.displayName;

            return (
              <section
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : order.id)}
                  className="w-full p-4 text-left space-y-2 hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={clsx(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            order.status === 'DISPUTED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : order.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          {order.status}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 inline-flex items-center gap-1">
                          {order.shippingMethod === 'PICKUP' ? (
                            <>
                              <MapPin className="w-3 h-3 text-teal-600" /> นัดรับ
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3 text-slate-500" /> ส่งพัสดุ ({order.paymentMethod})
                            </>
                          )}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-400 mt-1 truncate">
                        #{order.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black text-slate-900">
                        ฿{order.totalPrice.toLocaleString()}
                      </span>
                      {expanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
                    {order.dispute.reason || order.cancelReason || 'ไม่มีเหตุผลที่ระบุ'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">
                      ผู้ซื้อ: <strong className="text-slate-700">{buyerName}</strong>
                    </span>
                    <span className="truncate">
                      ร้าน: <strong className="text-slate-700">{sellerName}</strong>
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                    {/* Parties meta */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                        <p className="text-[10px] text-slate-400 font-bold">ผู้ซื้อ</p>
                        <p className="font-bold text-slate-800 truncate">{buyerName}</p>
                        <p className="text-[10px] text-amber-700 inline-flex items-center gap-1">
                          <UserX className="w-3 h-3" />
                          No-Show: {order.buyer.noShowCount} ครั้ง
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5">
                        <p className="text-[10px] text-slate-400 font-bold">ผู้ขาย</p>
                        <p className="font-bold text-slate-800 truncate">{sellerName}</p>
                        <p className="text-[10px] text-slate-600 inline-flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-500" />
                          เครดิตคงเหลือ: {order.seller.credits}
                        </p>
                      </div>
                    </div>

                    {/* Dispute & Schedule metadata */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-950 space-y-1">
                      <p className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        เปิดโดย:{' '}
                        <strong>
                          {order.dispute.openedBy === 'BUYER'
                            ? 'ผู้ซื้อ'
                            : order.dispute.openedBy === 'SELLER'
                              ? 'ผู้ขาย'
                              : order.dispute.openedBy || '-'}
                        </strong>{' '}
                        · {formatDateTime(order.dispute.openedAt)}
                      </p>
                      {order.schedule && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          นัดรับ: {order.schedule.locationName || '-'} ·{' '}
                          {order.schedule.dateIso || ''} {order.schedule.timeLabel || ''} (
                          {order.schedule.confirmedByBuyer ? 'ผู้ซื้อยืนยันแล้ว' : 'ยังไม่ยืนยัน'})
                        </p>
                      )}
                    </div>

                    {/* Books */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-500">
                        รายการหนังสือ ({order.items.length})
                      </p>
                      {order.items.map((book) => (
                        <div key={book.bookId} className="flex items-center gap-2.5">
                          {book.coverImageUrl ? (
                            <img
                              src={book.coverImageUrl}
                              alt={book.title}
                              className="w-10 h-14 rounded-lg object-cover bg-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded-lg bg-slate-100 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                              {book.title}
                            </p>
                            <p className="text-[10px] text-slate-400">เกรด {book.grade}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-800">
                            ฿{book.price.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Evidence Photos */}
                    {(order.receivedPhotoUrl || order.paymentSlipUrl) && (
                      <div className="grid grid-cols-2 gap-2">
                        {order.receivedPhotoUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              รูปยืนยันรับของ
                            </span>
                            <img
                              src={order.receivedPhotoUrl}
                              alt="รูปยืนยันรับของ"
                              className="w-full h-28 object-cover rounded-xl border border-slate-200"
                            />
                          </div>
                        )}
                        {order.paymentSlipUrl && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-500">
                              สลิปโอนเงิน
                            </span>
                            <img
                              src={order.paymentSlipUrl}
                              alt="สลิปโอนเงิน"
                              className="w-full h-28 object-cover rounded-xl border border-slate-200"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Chat History */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        ประวัติแชทล่าสุด ({order.recentMessages.length} ข้อความ)
                      </p>
                      {order.recentMessages.length === 0 ? (
                        <p className="text-[11px] text-slate-400 bg-slate-50 rounded-xl p-3">
                          ยังไม่มีข้อความในห้องแชท
                        </p>
                      ) : (
                        <div className="max-h-56 overflow-y-auto space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          {order.recentMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={clsx(
                                'p-2 rounded-lg text-[11px] leading-relaxed',
                                msg.senderRole === 'SYSTEM'
                                  ? 'bg-slate-200/70 text-slate-700 text-center'
                                  : msg.senderRole === 'BUYER'
                                    ? 'bg-white border border-slate-200 text-slate-800'
                                    : 'bg-teal-50 border border-teal-200 text-teal-950'
                              )}
                            >
                              <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                                <span className="font-bold">
                                  {msg.senderRole === 'SYSTEM'
                                    ? 'ระบบ'
                                    : msg.senderRole === 'BUYER'
                                      ? `ผู้ซื้อ (${msg.senderName || buyerName})`
                                      : `ผู้ขาย (${msg.senderName || sellerName})`}
                                </span>
                                <span>{formatDateTime(msg.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resolution Actions for DISPUTED */}
                    {order.status === 'DISPUTED' && (
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setResolveForm({
                              orderId: order.id,
                              resolution: 'CANCELLED',
                              adminNote: '',
                              refundCredit: true,
                              incrementBuyerNoShow: Boolean(
                                order.dispute.missedMeetingReportedAt
                              ),
                            })
                          }
                          leftIcon={<XCircle className="w-4 h-4 text-rose-600" />}
                          className="border-rose-200 text-rose-700 hover:bg-rose-50"
                        >
                          ยกเลิกออเดอร์
                        </Button>
                        <Button
                          onClick={() =>
                            setResolveForm({
                              orderId: order.id,
                              resolution: 'COMPLETED',
                              adminNote: '',
                              refundCredit: false,
                              incrementBuyerNoShow: false,
                            })
                          }
                          leftIcon={<CheckCircle2 className="w-4 h-4" />}
                        >
                          ปิดการขายสำเร็จ
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      <ConfirmSheet
        isOpen={!!resolveForm}
        onClose={() => !submitting && setResolveForm(null)}
        title={
          resolveForm?.resolution === 'COMPLETED'
            ? 'ตัดสินปิดการขายสำเร็จ (COMPLETED)?'
            : 'ตัดสินยกเลิกคำสั่งซื้อ (CANCELLED)?'
        }
        description={
          resolveForm?.resolution === 'COMPLETED'
            ? 'หนังสือจะเปลี่ยนเป็น SOLD และปิดออเดอร์สมบูรณ์'
            : 'หนังสือจะกลับไปวางขาย (AVAILABLE) และแจ้งเตือนทั้งสองฝ่าย'
        }
        confirmLabel={submitting ? 'กำลังบันทึก...' : 'ยืนยันคำตัดสิน'}
        tone={resolveForm?.resolution === 'CANCELLED' ? 'danger' : 'primary'}
        onConfirm={handleResolveSubmit}
      >
        {resolveForm && (
          <div className="space-y-3">
            {resolveForm.resolution === 'CANCELLED' && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resolveForm.refundCredit}
                    onChange={(e) =>
                      setResolveForm({ ...resolveForm, refundCredit: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)]"
                  />
                  <span className="font-semibold text-slate-800">
                    คืน 1 เครดิตให้ผู้ขาย
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resolveForm.incrementBuyerNoShow}
                    onChange={(e) =>
                      setResolveForm({
                        ...resolveForm,
                        incrementBuyerNoShow: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-rose-600"
                  />
                  <span className="font-semibold text-slate-800">
                    เพิ่มประวัติไม่มาตามนัดผู้ซื้อ (+1 noShowCount)
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                หมายเหตุคำตัดสินแอดมิน <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                maxLength={300}
                value={resolveForm.adminNote}
                onChange={(e) =>
                  setResolveForm({ ...resolveForm, adminNote: e.target.value })
                }
                placeholder="ระบุเหตุผลการตัดสินเพื่อบันทึกในระบบและแจ้งทั้งสองฝ่าย..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white resize-none focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
        )}
      </ConfirmSheet>

      <Toast isOpen={!!toast} onClose={() => setToast(null)} message={toast || ''} />
    </div>
  );
}
