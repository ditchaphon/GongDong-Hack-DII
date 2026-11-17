'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
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
import { scheduleToIso } from '@/lib/delivery';
import { maskContact } from '@/lib/masking';
import {
  clearDryRunStorage,
  createDryRunOrderFromInput,
  createDryRunOrderPreset,
  DryRunStoredState,
  generateDryRunHandoverCode,
  isDryRunOrderId,
  readDryRunStorage,
  writeDryRunStorage,
} from '@/lib/adminOrderDryRun';
import {
  BackendOrderDetail,
  BackendOrderMessage,
  mapBackendOrderDetailToV4Order,
  mapBackendOrderMessageToChatMessage,
} from '@/lib/mappers';
import { useLiff } from '@/hooks/useLiff';
import type { Book } from '@/types';

export interface CreateOrderInput {
  delivery: V4Delivery;
  shop: V4Order['shop'];
  shopId?: string;
  books: V4BookSnapshot[];
  shippingFee: number;
  schedule?: V4Schedule;
  shipping?: V4Shipping & { province?: string };
  shipWithinDays?: number;
  expectedTotal?: number;
  idempotencyKey?: string;
}

export interface V4OrdersContextValue {
  orders: V4Order[];
  activeBuyerCount: number;
  loading: boolean;
  hasResolved: boolean;
  error: string | null;
  refreshOrders: () => Promise<void>;
  fetchOrder: (id: string) => Promise<V4Order | undefined>;
  createOrder: (input: CreateOrderInput) => Promise<string>;
  createBatchOrders: (inputs: CreateOrderInput[], idempotencyKey?: string) => Promise<string[]>;
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
  reportMissedMeeting: (id: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
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
  verifyHandover: (id: string, code: string) => Promise<{ ok: boolean; error?: string }>;
  isMineAsBuyer: (order: V4Order) => boolean;
  isDryRunOrder: (id: string) => boolean;
  getDryRunRole: (orderId: string) => ViewRole;
  setDryRunRole: (orderId: string, role: ViewRole) => void;
  createDryRunBatchOrders: (inputs: CreateOrderInput[]) => Promise<string[]>;
  spawnDryRunPresetOrder: (delivery: V4Delivery, sourceBook?: Book | null) => string;
  clearDryRunOrders: () => void;
}

const OrdersContext = createContext<V4OrdersContextValue | null>(null);

const ORDERS_CACHE_PREFIX = 'gongdong.ordersCache.v1.';

interface OrdersCachePayload {
  orders: V4Order[];
}

function readOrdersCache(userKey: string): OrdersCachePayload | null {
  if (!userKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${ORDERS_CACHE_PREFIX}${userKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrdersCachePayload;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.orders)) {
      return null;
    }
    return { orders: parsed.orders };
  } catch {
    return null;
  }
}

function writeOrdersCache(userKey: string, orders: V4Order[]): void {
  if (!userKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${ORDERS_CACHE_PREFIX}${userKey}`,
      JSON.stringify({ orders })
    );
  } catch {
    // ignore storage quota errors
  }
}

function isOrdersContextRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/orders') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/cart') ||
    pathname.startsWith('/notifications')
  );
}

const TERMINAL_ORDER_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED']);

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError || err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

export const V4OrdersProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const { user, isReady, isLoggedIn, idToken, refreshUser } = useLiff();
  const userKey = user.id || user.lineUserId || '';
  const hydratedCacheKeyRef = useRef<string | null>(null);
  const loadedTokenRef = useRef<string | null>(null);
  const loadedSummaryTokenRef = useRef<string | null>(null);
  const [orders, setOrders] = useState<V4Order[]>([]);
  const [summaryBuyingActiveCount, setSummaryBuyingActiveCount] = useState<number | null>(null);
  const [messagesByOrder, setMessagesByOrder] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [dryRunState, setDryRunState] = useState<DryRunStoredState>({
    orders: [],
    messagesByOrder: {},
    roleByOrder: {},
  });
  const [loading, setLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate per-user cached orders immediately while fresh data fetches in background
  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || !idToken) {
      hydratedCacheKeyRef.current = null;
      loadedTokenRef.current = null;
      loadedSummaryTokenRef.current = null;
      setOrders([]);
      setSummaryBuyingActiveCount(null);
      setError(
        isLoggedIn && !idToken
          ? 'เซสชัน LINE หมดอายุ กรุณากดลองใหม่หรือเปิดผ่านเมนูอีกครั้ง'
          : null
      );
      setHasResolved(true);
      return;
    }
    if (!userKey || hydratedCacheKeyRef.current === userKey) return;
    hydratedCacheKeyRef.current = userKey;
    const cached = readOrdersCache(userKey);
    if (cached) {
      setOrders(cached.orders);
      setHasResolved(true);
    } else {
      setOrders([]);
      setHasResolved(false);
    }
  }, [isReady, isLoggedIn, idToken, userKey]);

  // Keep per-user cache synced after initial resolution (SWR across Rich Menu reloads)
  useEffect(() => {
    if (
      !isReady ||
      !isLoggedIn ||
      !idToken ||
      !userKey ||
      !hasResolved ||
      hydratedCacheKeyRef.current !== userKey
    ) {
      return;
    }
    writeOrdersCache(userKey, orders);
  }, [isReady, isLoggedIn, idToken, userKey, hasResolved, orders]);

  useEffect(() => {
    if (!isReady) return;
    if (!user.isAdmin) {
      setDryRunState({ orders: [], messagesByOrder: {}, roleByOrder: {} });
      return;
    }
    setDryRunState(readDryRunStorage());
  }, [isReady, user.isAdmin]);

  const commitDryRunState = useCallback(
    (updater: (prev: DryRunStoredState) => DryRunStoredState) => {
      setDryRunState((prev) => {
        const next = updater(prev);
        writeDryRunStorage(next);
        return next;
      });
    },
    []
  );

  const isDryRunOrder = useCallback(
    (id: string) => Boolean(user.isAdmin && isDryRunOrderId(id)),
    [user.isAdmin]
  );

  const getDryRunRole = useCallback(
    (orderId: string): ViewRole => dryRunState.roleByOrder[orderId] ?? 'BUYER',
    [dryRunState.roleByOrder]
  );

  const setDryRunRole = useCallback(
    (orderId: string, role: ViewRole) => {
      commitDryRunState((prev) => ({
        ...prev,
        roleByOrder: { ...prev.roleByOrder, [orderId]: role },
      }));
    },
    [commitDryRunState]
  );

  const clearDryRunOrders = useCallback(() => {
    clearDryRunStorage();
    setDryRunState({ orders: [], messagesByOrder: {}, roleByOrder: {} });
  }, []);

  const appendDryRunSystemMessage = (
    prevMessages: Record<string, ChatMessage[]>,
    orderId: string,
    text: string
  ): Record<string, ChatMessage[]> => ({
    ...prevMessages,
    [orderId]: [
      ...(prevMessages[orderId] ?? []),
      {
        id: `dryrun-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        from: 'SELLER',
        text,
        sentAtISO: new Date().toISOString(),
        kind: 'SYSTEM',
      },
    ],
  });

  const allOrders = user.isAdmin ? [...dryRunState.orders, ...orders] : orders;

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
      if (isDryRunOrder(id)) {
        return dryRunState.orders.find((o) => o.id === id);
      }
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
    [idToken, upsertOrder, isDryRunOrder, dryRunState.orders]
  );

  const refreshOrders = useCallback(async () => {
    if (!idToken) return;
    loadedTokenRef.current = idToken;
    setLoading(true);
    setError(null);
    try {
      const summary = await api.get<{
        buying?: Array<{ id: string }>;
        selling?: Array<{ id: string }>;
        details?: BackendOrderDetail[];
      }>('/api/users/me/orders?include=details', { token: idToken });

      if (Array.isArray(summary.details)) {
        setOrders(summary.details.map(mapBackendOrderDetailToV4Order));
        return;
      }

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
      setHasResolved(true);
    }
  }, [idToken]);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) {
      loadedTokenRef.current = null;
      loadedSummaryTokenRef.current = null;
      return;
    }
    if (isOrdersContextRoute(pathname)) {
      if (loadedTokenRef.current === idToken) return;
      refreshOrders();
      return;
    }
    // On public browsing routes (/, /search, /book/[id]), fetch lightweight summary for badge only
    if (
      loadedTokenRef.current === idToken ||
      loadedSummaryTokenRef.current === idToken
    ) {
      return;
    }
    loadedSummaryTokenRef.current = idToken;
    api
      .get<{ buying?: Array<{ id: string; status: string }> }>(
        '/api/users/me/orders?role=buying',
        { token: idToken }
      )
      .then((res) => {
        const count = (res.buying ?? []).filter(
          (o) => !TERMINAL_ORDER_STATUSES.has(o.status)
        ).length;
        setSummaryBuyingActiveCount(count);
      })
      .catch(() => {
        // Keep cached count silently on transient network error
      });
  }, [isReady, isLoggedIn, idToken, pathname, refreshOrders]);

  const needsOrdersContext = isOrdersContextRoute(pathname);
  const isHydrating =
    !isReady ||
    (isLoggedIn && Boolean(idToken) && needsOrdersContext && !hasResolved);

  const getOrder = useCallback(
    (id: string) => allOrders.find((order) => order.id === id),
    [allOrders]
  );

  const isMineAsBuyer = useCallback(
    (order: V4Order) => {
      if (isDryRunOrder(order.id)) {
        return (dryRunState.roleByOrder[order.id] ?? 'BUYER') === 'BUYER';
      }
      return (
        Boolean(user.id) &&
        (order.buyerId ? order.buyerId === user.id : order.shopId !== user.id)
      );
    },
    [user.id, isDryRunOrder, dryRunState.roleByOrder]
  );

  const fetchMessages = useCallback(
    async (orderId: string): Promise<ChatMessage[]> => {
      if (isDryRunOrder(orderId)) {
        return dryRunState.messagesByOrder[orderId] ?? [];
      }
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
    [idToken, isDryRunOrder, dryRunState.messagesByOrder]
  );

  const messagesFor = useCallback(
    (orderId: string) =>
      isDryRunOrder(orderId)
        ? dryRunState.messagesByOrder[orderId] ?? []
        : messagesByOrder[orderId] ?? [],
    [messagesByOrder, isDryRunOrder, dryRunState.messagesByOrder]
  );

  const sendMessage = useCallback(
    async (
      orderId: string,
      role: ViewRole,
      text: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (isDryRunOrder(orderId)) {
        const trimmed = text.trim();
        if (!trimmed) return { ok: false, error: 'กรุณาพิมพ์ข้อความ' };
        const maskedText = maskContact(trimmed);
        const msg: ChatMessage = {
          id: `dryrun-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          from: role,
          text: maskedText,
          sentAtISO: new Date().toISOString(),
          kind: 'TEXT',
        };
        commitDryRunState((prev) => ({
          ...prev,
          messagesByOrder: {
            ...prev.messagesByOrder,
            [orderId]: [...(prev.messagesByOrder[orderId] ?? []), msg],
          },
        }));
        return { ok: true };
      }
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
    [idToken, isDryRunOrder, commitDryRunState]
  );

  const buildOrderPayload = (input: CreateOrderInput) => {
    if (!input.shopId) throw new Error('ไม่พบรหัสผู้ขาย');
    const scheduledAtIso = input.schedule?.dateISO
      ? scheduleToIso(input.schedule.dateISO, input.schedule.timeLabel)
      : undefined;

    return {
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
      expected_total: input.expectedTotal,
      idempotency_key: input.idempotencyKey,
    };
  };

  const createOrder = async (input: CreateOrderInput): Promise<string> => {
    if (!idToken) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    const created = await api.post<{ order_id: string }>(
      '/api/orders',
      buildOrderPayload(input),
      { token: idToken }
    );

    await fetchOrder(created.order_id);
    return created.order_id;
  };

  const createBatchOrders = async (
    inputs: CreateOrderInput[],
    idempotencyKey?: string
  ): Promise<string[]> => {
    if (!idToken) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    const created = await api.post<{ orders: Array<{ order_id: string }> }>(
      '/api/orders/batch',
      {
        orders: inputs.map(buildOrderPayload),
        idempotency_key: idempotencyKey,
      },
      { token: idToken }
    );

    const ids = (created.orders ?? []).map((o) => o.order_id);
    await Promise.all(ids.map((orderId) => fetchOrder(orderId)));
    return ids;
  };

  const updateDryRunOrder = (
    id: string,
    updater: (order: V4Order) => V4Order,
    systemText?: string
  ) => {
    const now = new Date().toISOString();
    commitDryRunState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === id ? { ...updater(o), updatedAtISO: now } : o
      ),
      messagesByOrder: systemText
        ? appendDryRunSystemMessage(prev.messagesByOrder, id, systemText)
        : prev.messagesByOrder,
    }));
  };

  const createDryRunBatchOrders = async (
    inputs: CreateOrderInput[]
  ): Promise<string[]> => {
    if (!user.isAdmin) throw new Error('สำหรับ Admin เท่านั้น');
    const createdOrders = inputs.map((input) =>
      createDryRunOrderFromInput(input, user)
    );
    commitDryRunState((prev) => {
      let nextMessages = { ...prev.messagesByOrder };
      const nextRoles = { ...prev.roleByOrder };
      for (const order of createdOrders) {
        nextRoles[order.id] = 'BUYER';
        nextMessages = appendDryRunSystemMessage(
          nextMessages,
          order.id,
          `สร้างคำขอซื้อแบบ Dry-run (${order.delivery === 'MEETUP' ? 'นัดรับ' : 'ส่งพัสดุ COD'}) แล้ว · สลับมุมมองเป็นผู้ขายด้านบนเพื่อกดรับออเดอร์`
        );
      }
      return {
        orders: [...createdOrders, ...prev.orders],
        messagesByOrder: nextMessages,
        roleByOrder: nextRoles,
      };
    });
    return createdOrders.map((o) => o.id);
  };

  const spawnDryRunPresetOrder = (
    delivery: V4Delivery,
    sourceBook?: Book | null
  ): string => {
    const created = createDryRunOrderPreset(delivery, user, sourceBook);
    commitDryRunState((prev) => ({
      orders: [created, ...prev.orders],
      messagesByOrder: appendDryRunSystemMessage(
        prev.messagesByOrder,
        created.id,
        `สร้างออเดอร์ตัวอย่างแบบ Dry-run (${delivery === 'MEETUP' ? 'นัดรับ 6 หลัก' : 'ส่งพัสดุ COD'}) แล้ว · สลับมุมมองผู้ซื้อ ↔ ผู้ขายด้านบนได้เลย`
      ),
      roleByOrder: { ...prev.roleByOrder, [created.id]: 'SELLER' },
    }));
    return created.id;
  };

  const acceptOrder = async (id: string) => {
    if (isDryRunOrder(id)) {
      const target = dryRunState.orders.find((o) => o.id === id);
      if (!target) return { ok: false, error: 'ไม่พบออเดอร์ Dry-run' };
      const nextStatus =
        target.delivery === 'MEETUP' && target.schedule?.confirmedByBuyer
          ? 'SCHEDULED'
          : 'ACCEPTED';
      const handoverCode =
        nextStatus === 'SCHEDULED'
          ? target.handoverCode || generateDryRunHandoverCode()
          : target.handoverCode;
      updateDryRunOrder(
        id,
        (o) => ({ ...o, status: nextStatus, handoverCode, creditSpent: true }),
        nextStatus === 'SCHEDULED'
          ? 'ผู้ขายกดรับคำสั่งซื้อแล้ว (Dry-run · ไม่หักเครดิตจริง) · สร้างรหัสส่งมอบ 6 หลักและเปิดห้องแชทแล้ว'
          : 'ผู้ขายกดรับคำสั่งซื้อแล้ว (Dry-run · ไม่หักเครดิตจริง) · ห้องแชทเปิดใช้งานแล้ว'
      );
      return { ok: true };
    }
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
    if (isDryRunOrder(id)) {
      updateDryRunOrder(
        id,
        (o) => ({ ...o, status: 'REJECTED' }),
        'ผู้ขายปฏิเสธคำขอซื้อ (Dry-run)'
      );
      return { ok: true };
    }
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
    if (isDryRunOrder(id)) {
      const safeReason = reason?.trim() || 'ยกเลิกคำสั่งซื้อ';
      const role = getDryRunRole(id);
      updateDryRunOrder(
        id,
        (o) => ({ ...o, status: 'CANCELLED', cancelReason: safeReason }),
        `คำสั่งซื้อถูกยกเลิกโดย${role === 'BUYER' ? 'ผู้ซื้อ' : 'ผู้ขาย'} (Dry-run): ${safeReason}`
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      const safeReason = reason?.trim() || 'ยกเลิกคำสั่งซื้อ';
      await api.post(`/api/orders/${id}/cancel`, { reason: safeReason }, { token: idToken });
      await Promise.all([fetchOrder(id), refreshUser()]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'ยกเลิกออเดอร์ไม่สำเร็จ') };
    }
  };

  const proposeSchedule = async (id: string, schedule: V4Schedule) => {
    if (isDryRunOrder(id)) {
      const nextCode = schedule.confirmedByBuyer
        ? generateDryRunHandoverCode()
        : undefined;
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          schedule,
          status: schedule.confirmedByBuyer ? 'SCHEDULED' : o.status,
          handoverCode: nextCode ?? o.handoverCode,
        }),
        `บันทึกเวลานัดรับแล้ว: ${schedule.landmark} · ${schedule.dateISO} ${schedule.timeLabel} (Dry-run)`
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.patch(
        `/api/orders/${id}/schedule`,
        {
          scheduled_at: scheduleToIso(schedule.dateISO, schedule.timeLabel),
          schedule_date_iso: schedule.dateISO,
          schedule_time_label: schedule.timeLabel,
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
    if (isDryRunOrder(id)) {
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          status: 'SHIPPED',
          shipping: { ...o.shipping, ...shipping },
        }),
        `ผู้ขายจัดส่งพัสดุแล้ว (${shipping.carrier}: ${shipping.trackingNumber}) (Dry-run)`
      );
      return { ok: true };
    }
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
    if (isDryRunOrder(id)) {
      const now = new Date().toISOString();
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          status: 'COMPLETED',
          receivedPhoto: photo,
          receivedAtISO: now,
          review: { ...review, reviewedAtISO: now },
        }),
        'ผู้ซื้อยืนยันได้รับหนังสือและส่งรีวิวเรียบร้อยแล้ว (Dry-run)'
      );
      return { ok: true };
    }
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
    if (isDryRunOrder(id)) {
      updateDryRunOrder(
        id,
        (o) => ({ ...o, status: 'COMPLETED' }),
        'ปิดการขายเรียบร้อยแล้ว (Dry-run)'
      );
      return { ok: true };
    }
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

  const verifyHandover = async (
    id: string,
    code: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (isDryRunOrder(id)) {
      const target = dryRunState.orders.find((o) => o.id === id);
      if (!target) return { ok: false, error: 'ไม่พบออเดอร์ Dry-run' };
      if (!target.handoverCode || code.trim() !== target.handoverCode) {
        return {
          ok: false,
          error: target.handoverCode
            ? `รหัสส่งมอบไม่ถูกต้อง (รหัสฝั่งผู้ซื้อคือ ${target.handoverCode})`
            : 'ออเดอร์นี้ยังไม่มีรหัสส่งมอบ 6 หลัก',
        };
      }
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          status: 'COMPLETED',
          handoverCodeVerifiedAtISO: new Date().toISOString(),
        }),
        'ผู้ขายยืนยันรหัสส่งมอบ 6 หลักเรียบร้อยแล้ว (Dry-run)'
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/handover`,
        { handover_code: code },
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: extractErrorMessage(err, 'รหัสส่งมอบ 6 หลักไม่ถูกต้อง'),
      };
    }
  };

  const openDispute = async (id: string, reason: string, by?: ViewRole) => {
    if (isDryRunOrder(id)) {
      const now = new Date().toISOString();
      const actor = by ?? getDryRunRole(id);
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          status: 'DISPUTED',
          dispute: { reason, openedBy: actor, openedAtISO: now },
        }),
        `เปิดข้อพิพาท (Dry-run): ${reason}`
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(`/api/orders/${id}/dispute`, { reason }, { token: idToken });
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: extractErrorMessage(err, 'เปิดข้อพิพาทไม่สำเร็จ') };
    }
  };

  const reportMissedMeeting = async (id: string, reason?: string) => {
    if (isDryRunOrder(id)) {
      const now = new Date().toISOString();
      const safeReason = reason?.trim() || 'ผู้ซื้อไม่มาตามนัด (Dry-run)';
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          status: 'DISPUTED',
          missedMeetingReportedAtISO: now,
          dispute: { reason: safeReason, openedBy: 'SELLER', openedAtISO: now },
        }),
        `ผู้ขายแจ้งผู้ซื้อไม่มาตามนัด (Dry-run): ${safeReason}`
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/report-missed-meeting`,
        reason ? { reason } : undefined,
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: extractErrorMessage(err, 'แจ้งไม่มาตามนัดไม่สำเร็จ'),
      };
    }
  };

  const disputeMissedMeeting = async (id: string, reason: string) => {
    if (isDryRunOrder(id)) {
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          dispute: o.dispute
            ? { ...o.dispute, reason: `${o.dispute.reason} | คำชี้แจงผู้ซื้อ: ${reason}` }
            : {
                reason: `คำชี้แจงผู้ซื้อ: ${reason}`,
                openedBy: 'BUYER',
                openedAtISO: new Date().toISOString(),
              },
        }),
        `ผู้ซื้อส่งคำชี้แจงกรณีไม่มาตามนัด (Dry-run): ${reason}`
      );
      return { ok: true };
    }
    if (!idToken) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await api.post(
        `/api/orders/${id}/dispute-missed-meeting`,
        { reason },
        { token: idToken }
      );
      await Promise.all([fetchOrder(id), fetchMessages(id)]);
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
    if (isDryRunOrder(id)) {
      const now = new Date().toISOString();
      updateDryRunOrder(
        id,
        (o) => ({
          ...o,
          review: { ...reviewData, reviewedAtISO: now },
        }),
        'ผู้ซื้อให้คะแนนและรีวิวเรียบร้อยแล้ว (Dry-run)'
      );
      return { ok: true };
    }
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

  const activeBuyerCount =
    summaryBuyingActiveCount !== null && !needsOrdersContext
      ? summaryBuyingActiveCount
      : allOrders.filter(
          (o) => isMineAsBuyer(o) && !TERMINAL_ORDER_STATUSES.has(o.status)
        ).length;

  return (
    <OrdersContext.Provider
      value={{
        orders: allOrders,
        activeBuyerCount,
        loading: loading || isHydrating,
        hasResolved,
        error,
        refreshOrders,
        fetchOrder,
        createOrder,
        createBatchOrders,
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
        isDryRunOrder,
        getDryRunRole,
        setDryRunRole,
        createDryRunBatchOrders,
        spawnDryRunPresetOrder,
        clearDryRunOrders,
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
