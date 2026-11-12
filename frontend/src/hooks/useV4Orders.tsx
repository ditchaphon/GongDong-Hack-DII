'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  ChatMessage,
  V4Order,
  V4OrderStatus,
  V4Schedule,
  V4Shipping,
  ViewRole,
} from '@/types/v4';
import { MOCK_BUYER, MOCK_V4_CHAT, MOCK_V4_ORDERS } from '@/mocks/v4';
import { useLiff } from '@/hooks/useLiff';

export interface V4OrdersContextValue {
  orders: V4Order[];
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
  verifyHandover: (id: string, code: string) => boolean;
  isMineAsBuyer: (order: V4Order) => boolean;
}

const OrdersContext = createContext<V4OrdersContextValue | null>(null);

const code6 = () => String(Math.floor(100000 + Math.random() * 900000));

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
          return {
            ...item,
            status: 'ACCEPTED',
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
        text: 'รับคำขอแล้วค่ะ · นัดรับหรือชำระเงินได้เลย',
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

  const markPaid = (id: string) => {
    patchOrder(
      id,
      { slipCheck: 'PASSED', slipUploadedAtISO: new Date().toISOString() },
      'PAID'
    );
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

  const verifyHandover = (id: string, code: string) => {
    const order = getOrder(id);
    if (!order?.handoverCode) return false;
    if (order.handoverCode !== code.trim()) return false;
    patchOrder(
      id,
      {
        handoverCodeVerifiedAtISO: new Date().toISOString(),
        handoverCode: undefined,
      },
      'COMPLETED'
    );
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
