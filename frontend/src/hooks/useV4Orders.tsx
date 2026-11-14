'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  ChatMessage,
  V4BookSnapshot,
  V4Delivery,
  V4Order,
  V4Schedule,
  V4Shipping,
  ViewRole,
} from '@/types/v4';
import { api, ApiError } from '@/lib/api';
import {
  BackendOrderDetail,
  BackendOrderMessage,
  mapBackendOrderDetailToV4Order,
  mapBackendOrderMessageToChatMessage,
} from '@/lib/mappers';
import { useLiff } from '@/hooks/useLiff';

export interface CreateOrderInput {
  delivery: V4Delivery;
  shop: V4Order['shop'];
  shopId?: string;
  books: V4BookSnapshot[];
  shippingFee: number;
  schedule?: V4Schedule;
  shipping?: V4Shipping & { province?: string };
  shipWithinDays?: number;
}

export interface V4OrdersContextValue {
  orders: V4Order[];
  loading: boolean;
  error: string | null;
  refreshOrders: () => Promise<void>;
  fetchOrder: (id: string) => Promise<V4Order | undefined>;
  createOrder: (input: CreateOrderInput) => Promise<string>;
  confirmReceived: (
    id: string,
    photo: string,
    review: {
      rating: number;
      isGradeMatched: boolean;
      tags: string[];
      comment: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  getOrder: (id: string) => V4Order | undefined;
  messagesFor: (orderId: string) => ChatMessage[];
  fetchMessages: (orderId: string) => Promise<ChatMessage[]>;
  sendMessage: (
    orderId: string,
    role: ViewRole,
    text: string
  ) => Promise<{ ok: boolean; error?: string }>;
  acceptOrder: (id: string) => Promise<{ ok: boolean; error?: string }>;
  rejectOrder: (id: string) => Promise<{ ok: boolean; error?: string }>;
  cancelOrder: (id: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  proposeSchedule: (
    id: string,
    schedule: V4Schedule
  ) => Promise<{ ok: boolean; error?: string }>;
  confirmSchedule: (id: string) => Promise<{ ok: boolean; error?: string }>;
  markShipped: (
    id: string,
    shipping: V4Shipping
  ) => Promise<{ ok: boolean; error?: string }>;
  complete: (id: string) => Promise<{ ok: boolean; error?: string }>;
  openDispute: (
    id: string,
    reason: string,
    by?: ViewRole
  ) => Promise<{ ok: boolean; error?: string }>;
  reportMissedMeeting: (id: string) => Promise<{ ok: boolean; error?: string }>;
  disputeMissedMeeting: (
    id: string,
    reason: string
  ) => Promise<{ ok: boolean; error?: string }>;
  submitReview: (
    id: string,
    review: {
      rating: number;
      isGradeMatched: boolean;
      tags: string[];
      comment: string;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  verifyHandover: (id: string, code: string) => Promise<boolean>;
  isMineAsBuyer: (order: V4Order) => boolean;
}

const OrdersContext = createContext<V4OrdersContextValue | null>(null);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

export const V4OrdersProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, isReady, isLoggedIn, idToken, refreshUser } = useLiff();
  const [orders, setOrders] = useState<V4Order[]>([]);
  const [messagesByOrder, setMessagesByOrder] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsertOrder = useCallback((nextOrder: V4Order) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === nextOrder.id);
      if (exists) {
        return prev.map((o) =>
          o.id === nextOrder.id ? { ...o, ...nextOrder } : o
        );
      }
      return [nextOrder, ...prev];
    });
  }, []);

  const fetchOrder = useCallback(
    async (id: string): Promise<V4Order | undefined> => {
      if (!idToken) return undefined;
      try {
        const detail = await api.get<BackendOrderDetail>(`/api/orders/${id}`, {
          token: idToken,
        });
        const mapped = mapBackendOrderDetailToV4Order(detail);
        upsertOrder(mapped);
        return mapped;
      } catch (err) {
        console.warn('[useV4Orders] Failed to fetch order detail:', id, err);
        return undefined;
      }
    },
    [idToken, upsertOrder]
  );

  const refreshOrders = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await api.get<{
        buying?: Array<{ id: string }>;
        selling?: Array<{ id: string }>;
      }>('/api/users/me/orders', { token: idToken });

      const uniqueIds = Array.from(
        new Set([
          ...(summary.buying ?? []).map((o) => o.id),
          ...(summary.selling ?? []).map((o) => o.id),
        ])
      );

      if (uniqueIds.length === 0) {
        setOrders([]);
        return;
      }

      const details = await Promise.all(
        uniqueIds.map((orderId) =>
          api
            .get<BackendOrderDetail>(`/api/orders/${orderId}`, {
              token: idToken,
            })
            .then(mapBackendOrderDetailToV4Order)
            .catch(() => null)
        )
      );

      setOrders(details.filter((o): o is V4Order => o !== null));
    } catch (err) {
      setError(extractErrorMessage(err, 'โหลดรายการออเดอร์ไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) return;
    refreshOrders();
  }, [isReady, isLoggedIn, idToken, refreshOrders]);

  const getOrder = useCallback(
    (id: string) => orders.find((order) => order.id === id),
    [orders]
  );

  const isMineAsBuyer = useCallback(
    (order: V4Order) =>
      order.buyerId ? order.buyerId === user.id : order.shopId !== user.id,
    [user.id]
  );

  const fetchMessages = useCallback(
    async (orderId: string): Promise<ChatMessage[]> => {
      if (!idToken) return [];
      try {
        const raw = await api.get<BackendOrderMessage[]>(
          `/api/orders/${orderId}/messages`,
          { token: idToken }
        );
        const mapped = (Array.isArray(raw) ? raw : []).map(
          mapBackendOrderMessageToChatMessage
        );
        setMessagesByOrder((prev) => ({ ...prev, [orderId]: mapped }));
        return mapped;
      } catch (err) {
        console.warn('[useV4Orders] Failed to fetch messages:', err);
        return messagesByOrder[orderId] ?? [];
      }
    },
    [idToken]
  );

  const messagesFor = useCallback(
    (orderId: string) => messagesByOrder[orderId] ?? [],
    [messagesByOrder]
  );

  const sendMessage = useCallback(
    async (
      orderId: string,
      _role: ViewRole,
      text: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
      try {
        const created = await api.post<BackendOrderMessage>(
          `/api/orders/${orderId}/messages`,
          { text },
          { token: idToken }
        );
        const mapped = mapBackendOrderMessageToChatMessage(created);
        setMessagesByOrder((prev) => ({
          ...prev,
          [orderId]: [...(prev[orderId] ?? []), mapped],
        }));
        return { ok: true };
      } catch (err) {
        return { ok: false, error: extractErrorMessage(err, 'ส่งข้อความไม่สำเร็จ') };
      }
    },
    [idToken]
  );

  const createOrder = async (input: CreateOrderInput): Promise<string> => {
    if (!idToken) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    if (!input.shopId) throw new Error('ไม่พบรหัสผู้ขาย');

    const scheduledAtIso =
      input.schedule?.dateISO
        ? `${input.schedule.dateISO}T16:00:00.000Z`
        : undefined;

    const created = await api.post<{ order_id: string }>(
      '/api/orders',
      {
        seller_id: input.shopId,
        book_ids: input.books.map((b) => b.id),
        shipping_method: input.delivery === 'MEETUP' ? 'PICKUP' : 'DELIVERY',
        payment_method: 'COD',
        recipient_name: input.shipping?.receiverName,
        recipient_phone: input.shipping?.receiverPhone,
        buyer_province: input.shipping?.province,
        delivery_address: input.shipping?.receiverAddress,
        pickup_lat: input.schedule?.lat,
        pickup_lng: input.schedule?.lng,
        pickup_location_name: input.schedule?.landmark,
        scheduled_at: scheduledAtIso,
        schedule_date_iso: input.schedule?.dateISO,
        schedule_time_label: input.schedule?.timeLabel,
        ship_within_days: input.shipWithinDays,
      },
      { token: idToken }
    );

    await fetchOrder(created.order_id);
    return created.order_id;
  };

  const acceptOrder = async (id: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/accept`, undefined, { token: idToken });
      await Promise.all([fetchOrder(id), fetchMessages(id), refreshUser()]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'รับออเดอร์ไม่สำเร็จ') };
    }
  };

  const rejectOrder = async (id: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/reject`, undefined, { token: idToken });
      await fetchOrder(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'ปฏิเสธคำขอไม่สำเร็จ') };
    }
  };

  const cancelOrder = async (id: string, reason?: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/cancel`, { reason }, { token: idToken });
      await fetchOrder(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'ยกเลิกออเดอร์ไม่สำเร็จ') };
    }
  };

  const proposeSchedule = async (id: string, schedule: V4Schedule) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.patch(
        `/api/orders/${id}/schedule`,
        {
          scheduled_at: `${schedule.dateISO}T16:00:00.000Z`,
          pickup_lat: schedule.lat,
          pickup_lng: schedule.lng,
          pickup_location_name: schedule.landmark,
        },
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'อัปเดตเวลานัดไม่สำเร็จ') };
    }
  };

  const confirmSchedule = async (id: string) => {
    const order = getOrder(id);
    if (!order?.schedule) {
      return { ok: false, error: 'ไม่พบข้อมูลนัดหมาย' };
    }
    return proposeSchedule(id, { ...order.schedule, confirmedByBuyer: true });
  };

  const markShipped = async (id: string, shipping: V4Shipping) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.patch(
        `/api/orders/${id}/ship`,
        {
          courier_name: shipping.carrier,
          tracking_number: shipping.trackingNumber,
          parcel_image_url: shipping.boxPhoto,
        },
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'บันทึกการจัดส่งไม่สำเร็จ') };
    }
  };

  const confirmReceived: V4OrdersContextValue['confirmReceived'] = async (
    id,
    photo,
    review
  ) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/receive`,
        {
          received_photo_url: photo,
          review: {
            rating: review.rating,
            is_condition_accurate: review.isGradeMatched,
            tags: review.tags,
            comment: review.comment,
          },
        },
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'ยืนยันรับของไม่สำเร็จ') };
    }
  };

  const complete = async (id: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      const order = getOrder(id);
      if (order?.delivery === 'PARCEL') {
        await api.post(`/api/orders/${id}/complete-delivery`, undefined, {
          token: idToken,
        });
      } else {
        await api.post(`/api/orders/${id}/complete-meetup`, undefined, {
          token: idToken,
        });
      }
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'ปิดการขายไม่สำเร็จ') };
    }
  };

  const verifyHandover = async (id: string, code: string): Promise<boolean> => {
    if (!idToken) return false;
    try {
      await api.post(
        `/api/orders/${id}/handover`,
        { handover_code: code },
        { token: idToken }
      );
      await fetchOrder(id);
      return true;
    } catch {
      return false;
    }
  };

  const openDispute = async (id: string, reason: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/dispute`, { reason }, { token: idToken });
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'เปิดข้อพิพาทไม่สำเร็จ') };
    }
  };

  const reportMissedMeeting = async (id: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/report-missed-meeting`, undefined, {
        token: idToken,
      });
      await fetchOrder(id);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: extractErrorMessage(err, 'แจ้งไม่มาตามนัดไม่สำเร็จ'),
      };
    }
  };

  const disputeMissedMeeting = async (id: string, reason: string) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/dispute-missed-meeting`,
        { reason },
        { token: idToken }
      );
      await fetchOrder(id);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: extractErrorMessage(err, 'ส่งคำชี้แจงไม่สำเร็จ'),
      };
    }
  };

  const submitReview = async (
    id: string,
    reviewData: {
      rating: number;
      isGradeMatched: boolean;
      tags: string[];
      comment: string;
    }
  ) => {
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/review`,
        {
          rating: reviewData.rating,
          is_condition_accurate: reviewData.isGradeMatched,
          tags: reviewData.tags,
          comment: reviewData.comment,
        },
        { token: idToken }
      );
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, review: { ...reviewData, reviewedAtISO: now } } : o
        )
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'บันทึกรีวิวไม่สำเร็จ') };
    }
  };

  return (
    <OrdersContext.Provider
      value={{
        orders,
        loading,
        error,
        refreshOrders,
        fetchOrder,
        createOrder,
        confirmReceived,
        getOrder,
        messagesFor,
        fetchMessages,
        sendMessage,
        acceptOrder,
        rejectOrder,
        cancelOrder,
        proposeSchedule,
        confirmSchedule,
        markShipped,
        complete,
        openDispute,
        reportMissedMeeting,
        disputeMissedMeeting,
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
  if (!ctx) {
    throw new Error('useV4Orders must be used within V4OrdersProvider');
  }
  return ctx;
}
