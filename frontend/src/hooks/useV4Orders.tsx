'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  ChatMessage,
  V4BookSnapshot,
  V4Delivery,
  V4Order,
  V4OrderStatus,
  V4Schedule,
  V4Shipping,
  ViewRole,
} from '@/types/v4';
import { MOCK_BUYER, MOCK_V4_CHAT, MOCK_V4_ORDERS } from '@/mocks/v4';
import { useLiff } from '@/hooks/useLiff';

export interface CreateOrderInput {
  delivery: V4Delivery;
  shop: V4Order['shop'];
  shopId?: string;
  books: V4BookSnapshot[];
  shippingFee: number;
  schedule?: V4Schedule;
  shipping?: V4Shipping;
  shipWithinDays?: number;
}

export interface V4OrdersContextValue {
  orders: V4Order[];
  createOrder: (input: CreateOrderInput) => string;
  payOrder: (id: string, slipImage?: string) => void;
  confirmReceived: (
    id: string,
    photo: string,
    review: { rating: number; isGradeMatched: boolean; tags: string[]; comment: string }
  ) => void;
  getOrder: (id: string) => V4Order | undefined;
  messagesFor: (orderId: string) => ChatMessage[];
  sendMessage: (orderId: string, role: ViewRole, text: string) => void;
  acceptOrder: (id: string) => { ok: boolean; error?: string };
  rejectOrder: (id: string) => void;
  cancelOrder: (id: string) => void;
  patchOrder: (id: string, patch: Partial<V4Order>, status?: V4OrderStatus) => void;
  proposeSchedule: (id: string, schedule: V4Schedule) => void;
  confirmSchedule: (id: string) => void;
  markPaid: (id: string) => void;
  markShipped: (id: string, shipping: V4Shipping) => void;
  complete: (id: string) => void;
  openDispute: (id: string, reason: string, by: ViewRole) => void;
  submitReview: (
    id: string,
    review: { rating: number; isGradeMatched: boolean; tags: string[]; comment: string }
  ) => void;
  verifyHandover: (id: string, code: string) => boolean;
  isMineAsBuyer: (order: V4Order) => boolean;
}

const OrdersContext = createContext<V4OrdersContextValue | null>(null);

const code6 = () => String(Math.floor(100000 + Math.random() * 900000));

const SAMPLE_SLIP =
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=500';

export const V4OrdersProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, deductCredit } = useLiff();
  const [orders, setOrders] = useState<V4Order[]>(MOCK_V4_ORDERS);
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_V4_CHAT);

  const getOrder = (id: string) => orders.find((order) => order.id === id);

  const patchOrder = (
    id: string,
    patch: Partial<V4Order>,
    status?: V4OrderStatus
  ) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id
          ? {
              ...order,
              ...patch,
              ...(status ? { status } : {}),
              updatedAtISO: new Date().toISOString(),
            }
          : order
      )
    );
  };

  const isMineAsBuyer = (order: V4Order) =>
    order.buyer.nickname === MOCK_BUYER.nickname;

  const acceptOrder = (id: string) => {
    const order = getOrder(id);
    if (!order) return { ok: false, error: 'ไม่พบออเดอร์นี้' };
    if (order.status !== 'REQUESTED') {
      return { ok: false, error: 'คำขอนี้ถูกตอบไปแล้ว' };
    }
    if (user.credits < 1) {
      return { ok: false, error: 'เครดิตไม่พอ กรุณาเติมเครดิตก่อนรับออเดอร์' };
    }
    deductCredit(1);

    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          // Meet-up point + time were chosen in the request, so accepting
          // confirms the appointment. Parcel orders wait for payment.
          const scheduled = item.delivery === 'MEETUP' && !!item.schedule;
          return {
            ...item,
            status: scheduled ? 'SCHEDULED' : 'ACCEPTED',
            schedule: scheduled ? { ...item.schedule!, confirmedByBuyer: true } : item.schedule,
            creditSpent: true,
            updatedAtISO: now,
            handoverCode: item.handoverCode ?? code6(),
          };
        }
        // Accepting locks the book: other open requests for it are rejected.
        if (
          item.status === 'REQUESTED' &&
          item.shop.shopName === order.shop.shopName &&
          item.books.some((book) =>
            order.books.some((mine) => mine.id === book.id)
          )
        ) {
          return { ...item, status: 'REJECTED', updatedAtISO: now };
        }
        return item;
      })
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-accept-${id}`,
        orderId: id,
        from: 'SELLER',
        text:
          order.delivery === 'MEETUP'
            ? 'ผู้ขายรับคำขอแล้ว · นัดรับยืนยันแล้ว แชทในออเดอร์เปิดแล้ว'
            : 'ผู้ขายรับคำขอแล้ว · ชำระเงินเพื่อให้ผู้ขายเริ่มจัดส่ง',
        sentAtISO: now,
        kind: 'SYSTEM',
      },
    ]);
    return { ok: true };
  };

  const rejectOrder = (id: string) => {
    patchOrder(id, {}, 'REJECTED');
  };

  const cancelOrder = (id: string) => {
    patchOrder(id, {}, 'CANCELLED');
  };

  const proposeSchedule = (id: string, schedule: V4Schedule) => {
    patchOrder(id, { schedule });
  };

  const confirmSchedule = (id: string) => {
    const order = getOrder(id);
    if (!order?.schedule) return;
    patchOrder(
      id,
      { schedule: { ...order.schedule, confirmedByBuyer: true } },
      'SCHEDULED'
    );
  };

  const markPaid = (id: string) => payOrder(id);

  /** Money is held by GongDong until the buyer confirms receipt. */
  const payOrder = (id: string, slipImage?: string) => {
    const order = getOrder(id);
    const days = order?.shipWithinDays ?? 2;
    const now = Date.now();
    patchOrder(
      id,
      {
        slipCheck: 'PASSED',
        slipUploadedAtISO: new Date(now).toISOString(),
        slipImage: slipImage ?? order?.slipImage ?? SAMPLE_SLIP,
        shipByISO: new Date(now + days * 86400000).toISOString(),
      },
      'PAID'
    );
  };

  const confirmReceived: V4OrdersContextValue['confirmReceived'] = (id, photo, review) => {
    const now = new Date().toISOString();
    patchOrder(
      id,
      {
        receivedPhoto: photo,
        receivedAtISO: now,
        payoutReleasedAtISO: now,
        review: { ...review, reviewedAtISO: now },
      },
      'COMPLETED'
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-received-${id}`,
        orderId: id,
        from: 'BUYER',
        text: 'ผู้ซื้อยืนยันรับของพร้อมรูปถ่ายแล้ว · โอนเงินให้ผู้ขายเรียบร้อย',
        sentAtISO: now,
        kind: 'SYSTEM',
      },
    ]);
  };

  const createOrder = (input: CreateOrderInput) => {
    const id = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();
    const amount = input.books.reduce((sum, book) => sum + book.price, 0);
    const order: V4Order = {
      id,
      status: 'REQUESTED',
      delivery: input.delivery,
      buyer: MOCK_BUYER,
      shop: input.shop,
      shopId: input.shopId,
      books: input.books,
      amount,
      shippingFee: input.shippingFee,
      total: amount + input.shippingFee,
      createdAtISO: now,
      updatedAtISO: now,
      schedule: input.schedule,
      shipping: input.shipping,
      shipWithinDays: input.shipWithinDays,
      slipCheck: 'NONE',
      creditSpent: false,
    };
    setOrders((prev) => [order, ...prev]);
    return id;
  };

  const markShipped = (id: string, shipping: V4Shipping) => {
    patchOrder(id, { shipping }, 'SHIPPED');
  };

  const complete = (id: string) => {
    patchOrder(id, {}, 'COMPLETED');
  };

  const openDispute = (id: string, reason: string, by: ViewRole) => {
    patchOrder(
      id,
      {
        dispute: { reason, openedBy: by, openedAtISO: new Date().toISOString() },
      },
      'DISPUTED'
    );
  };

  const submitReview = (
    id: string,
    reviewData: { rating: number; isGradeMatched: boolean; tags: string[]; comment: string }
  ) => {
    patchOrder(id, {
      review: {
        ...reviewData,
        reviewedAtISO: new Date().toISOString(),
      },
    });
  };

  /** Seller scanned the buyer's QR at the meet-up: sale closes, chat locks. */
  const verifyHandover = (id: string, code: string) => {
    const order = getOrder(id);
    if (!order?.handoverCode) return false;
    if (order.handoverCode !== code.trim()) return false;
    const now = new Date().toISOString();
    patchOrder(
      id,
      {
        handoverCodeVerifiedAtISO: now,
        payoutReleasedAtISO: now,
        handoverCode: undefined,
      },
      'COMPLETED'
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-handover-${id}`,
        orderId: id,
        from: 'SELLER',
        text: 'ผู้ขายสแกน QR รับของแล้ว · ปิดการขายเรียบร้อย',
        sentAtISO: now,
        kind: 'SYSTEM',
      },
    ]);
    return true;
  };

  const sendMessage = (orderId: string, role: ViewRole, text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        orderId,
        from: role,
        text,
        sentAtISO: new Date().toISOString(),
      },
    ]);
  };

  const messagesFor = (orderId: string) =>
    messages.filter((message) => message.orderId === orderId);

  return (
    <OrdersContext.Provider
      value={{
        orders,
        createOrder,
        payOrder,
        confirmReceived,
        getOrder,
        messagesFor,
        sendMessage,
        acceptOrder,
        rejectOrder,
        cancelOrder,
        patchOrder,
        proposeSchedule,
        confirmSchedule,
        markPaid,
        markShipped,
        complete,
        openDispute,
        submitReview,
        verifyHandover,
        isMineAsBuyer,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
};

export function useV4Orders(): V4OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useV4Orders must be used within V4OrdersProvider');
  return ctx;
}
