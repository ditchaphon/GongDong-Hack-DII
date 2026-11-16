'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTab } from '@/components/layout/BottomTab';
import {
  Button,
  Chip,
  GradeBadge,
  StatusBadge,
  EmptyState,
  Toast,
} from '@/components/ui';
import { useSeller } from '@/hooks/useSeller';
import { useAppMode } from '@/hooks/useAppMode';
import { useV4Orders } from '@/hooks/useV4Orders';
import { StatusBadgeV4, LineOaBanner } from '@/components/v4';
import {
  Plus,
  BookOpen,
  Store,
  CreditCard,
  ShieldAlert,
  Bell,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
  Star,
  Pencil,
  EyeOff,
  Settings,
} from 'lucide-react';

type Tab = 'LISTINGS' | 'WAITING' | 'CLOSED';

export default function SellerShopPage() {
  const router = useRouter();
  const {
    shop,
    isShopSetup,
    credits,
    listings,
    setListingStatus,
  } = useSeller();

  const { mode, setMode } = useAppMode();
  const { orders: allOrders, isMineAsBuyer } = useV4Orders();
  const sales = allOrders.filter((order) => !isMineAsBuyer(order));

  // Landing on the dashboard with a ready shop means the seller hat is on.
  useEffect(() => {
    if (isShopSetup && mode !== 'SELLER') setMode('SELLER');
  }, [isShopSetup, mode, setMode]);

  const [tab, setTab] = useState<Tab>('LISTINGS');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pendingRequestBookIds = new Set(
    sales
      .filter((order) => order.status === 'REQUESTED')
      .flatMap((order) => order.books.map((book) => book.id))
  );
  const hasPendingRequest = (bookId: string) => pendingRequestBookIds.has(bookId);
  const activeListings = listings.filter(
    (l) =>
      (l.status === 'ACTIVE' || l.status === 'WAITING_PAYMENT') &&
      !hasPendingRequest(l.id)
  );
  const pendingRequestListings = listings.filter(
    (l) => l.status !== 'HIDDEN' && hasPendingRequest(l.id)
  );
  const hiddenListings = listings.filter((l) => l.status === 'HIDDEN');
  const completedSales = sales.filter((o) => o.status === 'COMPLETED');
  const completedCount = completedSales.length;
  // Orders still in progress: awaiting confirmation, shipping, or cash on delivery.
  const waitingOrders = sales.filter((o) =>
    ['REQUESTED', 'ACCEPTED', 'PAID', 'SHIPPED', 'SCHEDULED'].includes(o.status)
  );
  const newOrderCount = sales.filter((o) => o.status === 'REQUESTED').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar
        title="ร้านของฉัน"
        showBack={false}
        rightAction={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="แจ้งเตือนผู้ขาย"
              onClick={() => router.push('/notifications')}
              className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100"
            >
              <Bell className="w-5 h-5 text-slate-700" />
              {newOrderCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {newOrderCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="ออเดอร์"
              onClick={() => router.push('/orders')}
              className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100"
            >
              <Package className="w-5 h-5 text-slate-700" />
              {newOrderCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {newOrderCount}
                </span>
              )}
            </button>
          </div>
        }
      />

      <div className="p-4 space-y-4">
        <LineOaBanner />
        {/* Shop header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {shop?.avatar ? (
              <img
                src={shop.avatar}
                alt={shop.shopName || 'ร้านของฉัน'}
                className="w-12 h-12 rounded-full object-cover bg-slate-100 border border-slate-200"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Store className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {shop?.shopName || 'ยังไม่ได้ตั้งชื่อร้าน'}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 flex-wrap">
                <span>ขายแล้ว {completedCount} ครั้ง</span>
                {shop?.payeeVerified ? (
                  <span className="text-emerald-700 font-medium">• ยืนยันตัวตนแล้ว</span>
                ) : (
                  <span className="text-amber-700 font-medium">• ยังไม่ยืนยันตัวตน</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="ตั้งค่าร้าน"
                onClick={() => router.push('/seller/setup')}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-base font-black text-slate-900">
                {activeListings.length}
              </div>
              <div className="text-[10px] text-slate-500">ประกาศขาย</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-base font-black text-slate-900">
                {completedCount}
              </div>
              <div className="text-[10px] text-slate-500">ขายสำเร็จ</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-base font-black text-slate-900">
                {newOrderCount}
              </div>
              <div className="text-[10px] text-slate-500">รอตอบรับ</div>
            </div>
          </div>

          {!isShopSetup ? (
            <button
              type="button"
              onClick={() => router.push('/seller/setup')}
              className="w-full flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left"
            >
              <Store className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="flex-1 text-[11px] text-emerald-900 leading-snug">
                เปิดร้านก่อนลงขาย · กรอกข้อมูลร้าน ตารางจัดส่ง และยืนยันตัวตน (KYC)
              </span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </button>
          ) : !shop?.payeeVerified ? (
            <button
              type="button"
              onClick={() => router.push('/seller/setup?step=4')}
              className="w-full flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="flex-1 text-[11px] text-amber-900 leading-snug">
                ยังไม่ยืนยันตัวตน (KYC) · กดเพื่อกรอกเลขบัตรประชาชนและชื่อจริง
              </span>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </button>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            fullWidth
            leftIcon={<CreditCard className="w-4 h-4" />}
            onClick={() => router.push('/seller/credits')}
          >
            เติมเครดิต · เหลือ {credits}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Chip
            label="หนังสือที่ลงขาย"
            selected={tab === 'LISTINGS'}
            count={activeListings.length}
            onClick={() => setTab('LISTINGS')}
            size="sm"
          />
          <Chip
            label="ระหว่างทำการ"
            selected={tab === 'WAITING'}
            count={waitingOrders.length}
            onClick={() => setTab('WAITING')}
            size="sm"
          />
          <Chip
            label="ประวัติการขาย"
            selected={tab === 'CLOSED'}
            count={completedCount}
            onClick={() => setTab('CLOSED')}
            size="sm"
          />
        </div>

        {/* S4L — listings */}
        {tab === 'LISTINGS' && (
          <div className="space-y-3">
            {activeListings.length === 0 &&
            hiddenListings.length === 0 &&
            pendingRequestListings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState
                  icon={<BookOpen className="w-8 h-8 text-slate-400" />}
                  title="ยังไม่มีประกาศขาย"
                  description="ลงขายฟรี ไม่มีค่าใช้จ่ายล่วงหน้า จะใช้เครดิตเมื่อมีคนขอซื้อและคุณกดรับ"
                  actionText="ลงขายเล่มแรก"
                  onAction={() => router.push('/seller/list')}
                />
              </div>
            ) : (
              activeListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 flex gap-3"
                >
                  <div className="w-16 h-22 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    <img
                      src={listing.photos.cover}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                        {listing.title}
                      </h4>
                      <GradeBadge grade={listing.grade} size="sm" showDescription={false} />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {listing.isSet ? `ยกชุด ${listing.totalVolumes} เล่ม` : 'เล่มเดียว'}
                    </p>
                    <p className="text-sm font-black text-[#8B5E3C]">
                      ฿{listing.price.toLocaleString()}
                    </p>
                    {listing.status === 'WAITING_PAYMENT' && (
                      <div className="text-[10px] text-amber-600 font-semibold pt-0.5">
                        มีคนขอซื้อ · ล็อกการแก้ไข
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => router.push(`/seller/listings/${listing.id}/edit`)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="w-3 h-3" />
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={listing.status === 'WAITING_PAYMENT'}
                        onClick={async () => {
                          try {
                            await setListingStatus(listing.id, 'HIDDEN');
                            setToastMessage('ซ่อนประกาศแล้ว');
                          } catch (err) {
                            setToastMessage(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ');
                          }
                        }}
                        title={
                          listing.status === 'WAITING_PAYMENT'
                            ? 'ซ่อนไม่ได้ขณะมีคนขอซื้อ'
                            : 'ซ่อนประกาศชั่วคราว'
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <EyeOff className="w-3 h-3" />
                        ซ่อน
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {pendingRequestListings.length > 0 && (
              <div className="space-y-2 pt-1">
                <h3 className="text-[11px] font-bold text-amber-600 uppercase tracking-wider px-1">
                  ซ่อนชั่วคราว · มีคนขอซื้อ ({pendingRequestListings.length})
                </h3>
                {pendingRequestListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-white rounded-2xl border border-dashed border-amber-300 p-3 flex items-center gap-3"
                  >
                    <div className="w-12 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      <img
                        src={listing.photos.cover}
                        alt={listing.title}
                        className="w-full h-full object-cover opacity-70"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-700 line-clamp-1">
                        {listing.title}
                      </h4>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        ไม่แสดงให้ผู้ซื้อเห็นจนกว่าจะปิดคำขอ
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/orders')}
                      className="text-[11px] font-semibold text-[var(--color-primary-dark)]"
                    >
                      ดูคำขอ
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hiddenListings.length > 0 && (
              <div className="space-y-2 pt-1">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  ซ่อนอยู่ ({hiddenListings.length})
                </h3>
                {hiddenListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-white rounded-2xl border border-dashed border-slate-300 p-3 flex items-center gap-3"
                  >
                    <div className="w-12 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      <img
                        src={listing.photos.cover}
                        alt={listing.title}
                        className="w-full h-full object-cover opacity-70"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-slate-700 line-clamp-1">
                        {listing.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        ไม่แสดงให้ผู้ซื้อเห็น
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await setListingStatus(listing.id, 'ACTIVE');
                          setToastMessage('แสดงประกาศอีกครั้งแล้ว');
                        } catch (err) {
                          setToastMessage(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ');
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-700"
                    >
                      แสดงอีกครั้ง
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* In-progress orders: each card opens the order detail */}
        {tab === 'WAITING' && (
          <div className="space-y-3">
            {waitingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState
                  icon={<Clock className="w-8 h-8 text-slate-400" />}
                  title="ไม่มีงานระหว่างทำ"
                  description="คำขอซื้อและออเดอร์ที่ยังไม่ปิดการขายจะแสดงที่นี่"
                />
              </div>
            ) : (
              waitingOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 hover:border-slate-300"
                >
                  <div className="flex items-start gap-3">
                    <img src={order.books[0]?.cover} alt="" className="w-11 h-15 rounded-lg object-cover bg-slate-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{order.books[0]?.title}</h4>
                        <StatusBadgeV4 status={order.status} size="sm" />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        #{order.id} · {order.delivery === 'MEETUP' ? 'นัดรับ' : 'ส่งพัสดุ'}
                      </p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">฿{order.amount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                    <span className="text-slate-600">
                      {order.status === 'REQUESTED'
                        ? 'มีคนขอซื้อ · รอคุณตอบรับ'
                        : order.status === 'ACCEPTED'
                        ? 'ยืนยันการส่ง/นัดรับ'
                        : order.status === 'PAID'
                        ? 'ส่งแล้ว · รอเก็บเงินปลายทาง'
                        : order.status === 'SHIPPED'
                        ? 'ส่งแล้ว · รอเก็บเงินปลายทาง'
                        : 'นัดรับ · เก็บเงินสดหน้างาน'}
                    </span>
                    <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-primary-dark)] shrink-0">
                      ดูรายละเอียด
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Closed sales with the buyer's review */}
        {tab === 'CLOSED' && (
          <div className="space-y-3">
            {completedSales.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState
                  icon={<CheckCircle2 className="w-8 h-8 text-slate-400" />}
                  title="ยังไม่มีรายการที่ปิดการขาย"
                  description="เมื่อขายหนังสือได้ รายการและรีวิวจากผู้ซื้อจะแสดงที่นี่"
                />
              </div>
            ) : (
              completedSales.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/orders/${order.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5 hover:border-slate-300"
                >
                  <div className="flex items-start gap-3">
                    <img src={order.books[0]?.cover} alt="" className="w-11 h-15 rounded-lg object-cover bg-slate-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-2">{order.books[0]?.title}</h4>
                      <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">ได้รับเงิน ฿{order.amount.toLocaleString()}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 self-center" />
                  </div>
                  {order.review ? (
                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${n <= order.review!.rating ? 'fill-amber-400 stroke-amber-400' : 'stroke-slate-300'}`}
                          />
                        ))}
                        <span className="ml-1 text-[10px] font-semibold text-slate-500">
                          {order.review.isGradeMatched ? '· คุณภาพตรงเกรด' : '· ไม่ตรงเกรด'}
                        </span>
                      </div>
                      {order.review.comment && (
                        <p className="text-[11px] text-slate-700 line-clamp-2">“{order.review.comment}”</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">ผู้ซื้อยังไม่ได้รีวิว</p>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <BottomTab orderBadge={newOrderCount} />

      <Toast
        isOpen={!!toastMessage}
        onClose={() => setToastMessage(null)}
        message={toastMessage || ''}
      />
    </div>
  );
}
