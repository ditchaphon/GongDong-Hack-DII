'use client';

import React, { useState } from 'react';
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
import { useLiff } from '@/hooks/useLiff';
import {
  Plus,
  BookOpen,
  Store,
  CreditCard,
  ShieldAlert,
  Eye,
  Heart,
  ChevronRight,
  Package,
  Clock,
  CheckCircle2,
} from 'lucide-react';

type Tab = 'LISTINGS' | 'WAITING' | 'CLOSED';

export default function SellerShopPage() {
  const router = useRouter();
  const { user } = useLiff();
  const { isVerified, credits, listings, orders } = useSeller();

  const [tab, setTab] = useState<Tab>('LISTINGS');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeListings = listings.filter(
    (l) => l.status === 'ACTIVE' || l.status === 'WAITING_PAYMENT'
  );
  const waitingOrders = orders.filter(
    (o) => o.status === 'WAITING_PAYMENT' || o.status === 'PAYMENT_SUBMITTED'
  );
  const closedListings = listings.filter((l) => l.status === 'CLOSED');
  const newOrderCount = orders.filter((o) => o.status === 'PENDING_ACCEPT').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-24">
      <TopBar
        title="ร้านของฉัน"
        showBack={false}
        rightAction={
          <button
            type="button"
            aria-label="ออเดอร์"
            onClick={() => router.push('/seller/orders')}
            className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100"
          >
            <Package className="w-5 h-5 text-slate-700" />
            {newOrderCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {newOrderCount}
              </span>
            )}
          </button>
        }
      />

      <div className="p-4 space-y-4">
        {/* Shop header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            {user.pictureUrl ? (
              <img
                src={user.pictureUrl}
                alt={user.displayName}
                className="w-12 h-12 rounded-full object-cover bg-slate-100"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Store className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {user.displayName}
              </h1>
              <p className="text-[11px] text-slate-500">
                {isVerified ? 'ผู้ขายยืนยันตัวตนแล้ว ✓' : 'ยังไม่ยืนยันตัวตน'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">เครดิต</div>
              <div className="text-lg font-black text-emerald-700">{credits}</div>
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
                {orders.filter((o) => o.status === 'COMPLETED').length}
              </div>
              <div className="text-[10px] text-slate-500">ขายสำเร็จ</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <div className="text-base font-black text-slate-900">
                {orders.filter((o) => o.status === 'PENDING_ACCEPT').length}
              </div>
              <div className="text-[10px] text-slate-500">รอตอบรับ</div>
            </div>
          </div>

          {!isVerified && (
            <button
              type="button"
              onClick={() => router.push('/seller/verify')}
              className="w-full flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="flex-1 text-[11px] text-amber-900 leading-snug">
                ยืนยันตัวตนเพื่อเริ่มลงขาย และรับเครดิตฟรี 1 เครดิต
              </span>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              fullWidth
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => router.push('/seller/list')}
            >
              ลงขายหนังสือ
            </Button>
            <Button
              size="sm"
              variant="outline"
              fullWidth
              leftIcon={<CreditCard className="w-4 h-4" />}
              onClick={() => router.push('/seller/credits')}
            >
              เติมเครดิต
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <Chip
            label="ประกาศของฉัน"
            selected={tab === 'LISTINGS'}
            count={activeListings.length}
            onClick={() => setTab('LISTINGS')}
            size="sm"
          />
          <Chip
            label="รอชำระเงิน"
            selected={tab === 'WAITING'}
            count={waitingOrders.length}
            onClick={() => setTab('WAITING')}
            size="sm"
          />
          <Chip
            label="ปิดการขาย"
            selected={tab === 'CLOSED'}
            onClick={() => setTab('CLOSED')}
            size="sm"
          />
        </div>

        {/* S4L — listings */}
        {tab === 'LISTINGS' && (
          <div className="space-y-3">
            {activeListings.length === 0 ? (
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
                    <p className="text-sm font-black text-[#06C755]">
                      ฿{listing.price.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {listing.views}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Heart className="w-3 h-3" /> {listing.savedCount}
                      </span>
                      {listing.status === 'WAITING_PAYMENT' && (
                        <span className="text-amber-600 font-semibold">มีคนขอซื้อ</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* S4W — waiting for payment */}
        {tab === 'WAITING' && (
          <div className="space-y-3">
            {waitingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState
                  icon={<Clock className="w-8 h-8 text-slate-400" />}
                  title="ไม่มีออเดอร์ที่รอชำระเงิน"
                  description="ออเดอร์ที่คุณรับแล้วแต่ผู้ซื้อยังไม่โอนเงินหรือแนบสลิปจะแสดงที่นี่"
                />
              </div>
            ) : (
              waitingOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={order.books[0]?.photos.cover}
                        alt=""
                        className="w-10 h-14 rounded-lg object-cover bg-slate-100"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                          {order.books[0]?.title}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {order.buyerName} · #{order.id}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {order.deliveryMethod === 'MEETUP'
                        ? `นัดรับ · ${order.meetupDetails?.scheduledAt}`
                        : `ส่งพัสดุ · ฿${order.shippingFee}`}
                    </span>
                    <span className="font-bold text-slate-900">
                      ฿{order.totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    fullWidth
                    onClick={() => router.push(`/seller/meetup/${order.id}`)}
                  >
                    {order.status === 'PAYMENT_SUBMITTED'
                      ? 'ตรวจสลิปและจัดส่ง'
                      : 'ดูรายละเอียด / กระตุ้นผู้ซื้อ'}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* S4C — closed */}
        {tab === 'CLOSED' && (
          <div className="space-y-3">
            {closedListings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState
                  icon={<CheckCircle2 className="w-8 h-8 text-slate-400" />}
                  title="ยังไม่มีรายการที่ปิดการขาย"
                  description="เมื่อขายหนังสือได้ รายการจะย้ายมาแสดงในแท็บนี้"
                />
              </div>
            ) : (
              closedListings.map((listing) => (
                <div
                  key={listing.id}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 flex gap-3 opacity-90"
                >
                  <div className="w-14 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    <img
                      src={listing.photos.cover}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                      {listing.title}
                    </h4>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      ขายได้ ฿{listing.price.toLocaleString()}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> ปิดการขายแล้ว
                    </span>
                  </div>
                </div>
              ))
            )}

            {orders
              .filter((o) => o.status === 'COMPLETED')
              .map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/seller/meetup/${order.id}/closed`)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 text-left hover:bg-slate-50"
                >
                  <span className="text-xs text-slate-600">
                    ออเดอร์ #{order.id} · {order.buyerName}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
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
