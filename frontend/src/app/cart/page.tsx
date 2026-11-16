'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { TopBar } from '@/components/layout/TopBar';
import { Button, BottomSheet, EmptyState } from '@/components/ui';
import { CartShopGroup, useCart } from '@/hooks/useCart';
import { useLiff } from '@/hooks/useLiff';
import { CreateOrderInput, useV4Orders } from '@/hooks/useV4Orders';
import { api, ApiError } from '@/lib/api';
import { toV4Grade } from '@/lib/catalog';
import {
  BackendBookDetail,
  BackendPublicShopResponse,
  mapBackendBookDetailToBook,
  mapPublicShopToShopProfile,
} from '@/lib/mappers';
import { Book, BookedPickupSlot, DeliveryMethod, ShopProfile } from '@/types';
import {
  calcParcelFee,
  expandShopHourlySlots,
  isSlotBookedForDate,
  mapDirectionsUrl,
  mapEmbedUrl,
  shipDeadlineDays,
  upcomingDates,
} from '@/lib/delivery';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Hourglass,
  Info,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
} from 'lucide-react';

const MAX_PENDING_ORDERS = 10;

interface ShopCheckoutConfig {
  selected: boolean;
  method: DeliveryMethod;
  pointId: string;
  dateISO: string;
  slot: string;
}

interface ShopValidationResult {
  points: ShopProfile['meetupPoints'];
  dates: Array<{ iso: string; label: string }>;
  slots: string[];
  bookedSlots: BookedPickupSlot[];
  hasAvailableSlot: boolean;
  canMeetup: boolean;
  canParcel: boolean;
  delivery: DeliveryMethod | null;
  hasMethodConflict: boolean;
  conflictingBookIds: Set<string>;
  unavailableBookIds: Set<string>;
  nonCodBookIds: Set<string>;
  existingPendingOrderId: string | null;
  issueMessages: string[];
  isBlockingIssue: boolean;
}

function makeAttemptKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function findFirstFreeDateAndSlot(
  dates: Array<{ iso: string; label: string }>,
  slots: string[],
  bookedSlots: BookedPickupSlot[]
): { dateISO: string; slot: string } | null {
  for (const d of dates) {
    for (const s of slots) {
      if (!isSlotBookedForDate(d.iso, s, bookedSlots)) {
        return { dateISO: d.iso, slot: s };
      }
    }
  }
  return null;
}

function evaluateShopGroup(
  group: CartShopGroup,
  shop: ShopProfile | null | undefined,
  isShopLoading: boolean,
  config: ShopCheckoutConfig | undefined,
  missingBookIds: Set<string>,
  pendingOrderIdBySeller: Map<string, string>,
  currentUserId?: string
): ShopValidationResult {
  const points = shop?.meetupPoints ?? [];
  const availableDays = shop?.availableDays?.length ? shop.availableDays : ['จ', 'อ', 'พ', 'พฤ', 'ศ'];
  const slots = expandShopHourlySlots(shop?.availableSlots ?? []);
  const dates = upcomingDates(availableDays, 6, new Date(), shop?.unavailableDates ?? []);
  const bookedSlots = shop?.bookedPickupSlots ?? [];
  const firstFree = findFirstFreeDateAndSlot(dates, slots, bookedSlots);
  const hasAvailableSlot = Boolean(firstFree);

  const unavailableBookIds = new Set<string>();
  const nonCodBookIds = new Set<string>();
  for (const book of group.items) {
    if (missingBookIds.has(book.id) || (book.status && book.status !== 'AVAILABLE')) {
      unavailableBookIds.add(book.id);
    }
    if (book.codEnabled === false) {
      nonCodBookIds.add(book.id);
    }
  }

  const allMeetupAllowed = group.items.every((b) => b.deliveryMethods.includes('MEETUP'));
  const allParcelAllowed = group.items.every((b) => b.deliveryMethods.includes('PARCEL'));
  const shopSupportsParcel = Boolean(shop?.supportsParcel && shop?.payeeVerified);
  const canMeetup = !isShopLoading && group.items.length > 0 && allMeetupAllowed && points.length > 0;
  const canParcel = !isShopLoading && group.items.length > 0 && allParcelAllowed && shopSupportsParcel;

  const hasMethodConflict = !isShopLoading && !canMeetup && !canParcel;
  const conflictingBookIds = new Set<string>();
  if (hasMethodConflict) {
    for (const book of group.items) {
      const supportsM = book.deliveryMethods.includes('MEETUP') && points.length > 0;
      const supportsP = book.deliveryMethods.includes('PARCEL') && shopSupportsParcel;
      if (!supportsM || !supportsP) {
        conflictingBookIds.add(book.id);
      }
    }
  }

  let delivery: DeliveryMethod | null = null;
  if (canMeetup && canParcel) {
    delivery = config?.method === 'PARCEL' ? 'PARCEL' : 'MEETUP';
  } else if (canMeetup) {
    delivery = 'MEETUP';
  } else if (canParcel) {
    delivery = 'PARCEL';
  }

  const isOwnShop = Boolean(currentUserId && group.sellerId === currentUserId);
  const existingPendingOrderId = pendingOrderIdBySeller.get(group.sellerId) ?? null;
  const issueMessages: string[] = [];

  if (isOwnShop) {
    issueMessages.push('ไม่สามารถสั่งซื้อหนังสือจากร้านของตนเองได้ กรุณานำรายการนี้ออก');
  }
  if (existingPendingOrderId) {
    issueMessages.push('คุณมีคำขอซื้อที่รอร้านค้านี้อนุมัติอยู่แล้ว (จำกัด 1 คำขอค้างต่อร้าน)');
  }
  if (unavailableBookIds.size > 0) {
    issueMessages.push('มีหนังสือที่ถูกจอง/ขายแล้ว กรุณานำออกจากรายการก่อนสั่งซื้อ');
  }
  if (nonCodBookIds.size > 0) {
    issueMessages.push('มีหนังสือที่ไม่รองรับการชำระเงินปลายทาง/หน้างาน กรุณานำออกจากรายการ');
  }
  if (hasMethodConflict) {
    if (!allMeetupAllowed && !allParcelAllowed) {
      issueMessages.push('หนังสือในร้านนี้มีวิธีจัดส่งขัดแย้งกัน (เช่น เล่มหนึ่งนัดรับเท่านั้น อีกเล่มส่งพัสดุเท่านั้น) กรุณาลบเล่มที่ขัดแย้งออก');
    } else if (points.length === 0 && !canParcel) {
      issueMessages.push('ร้านนี้ยังไม่ได้ตั้งจุดนัดรับ และยังไม่รองรับการจัดส่งพัสดุ');
    } else {
      issueMessages.push('ไม่มีวิธีรับหนังสือที่ใช้ร่วมกันได้สำหรับรายการในร้านนี้');
    }
  }

  const selectedDateISO = config?.dateISO || firstFree?.dateISO || dates[0]?.iso || '';
  const selectedSlot = config?.slot || firstFree?.slot || slots[0] || '';
  const selectedSlotBooked =
    delivery === 'MEETUP' &&
    Boolean(selectedDateISO && selectedSlot) &&
    isSlotBookedForDate(selectedDateISO, selectedSlot, bookedSlots);
  const meetupSlotInvalid =
    delivery === 'MEETUP' && (!hasAvailableSlot || !selectedDateISO || !selectedSlot || selectedSlotBooked);

  if (delivery === 'MEETUP' && !isShopLoading) {
    if (!hasAvailableSlot) {
      issueMessages.push('ร้านนี้ไม่มีวันหรือช่วงเวลานัดรับว่างในช่วงถัดไป กรุณาเลือกส่งพัสดุหรือติดต่อร้านภายหลัง');
    } else if (selectedSlotBooked) {
      issueMessages.push('ช่วงเวลานัดรับที่เลือกมีผู้จองแล้ว กรุณาเลือกเวลาอื่น');
    }
  }

  const isBlockingIssue =
    isOwnShop ||
    isShopLoading ||
    Boolean(existingPendingOrderId) ||
    unavailableBookIds.size > 0 ||
    nonCodBookIds.size > 0 ||
    meetupSlotInvalid ||
    !delivery;

  return {
    points,
    dates,
    slots,
    bookedSlots,
    hasAvailableSlot,
    canMeetup,
    canParcel,
    delivery,
    hasMethodConflict,
    conflictingBookIds,
    unavailableBookIds,
    nonCodBookIds,
    existingPendingOrderId,
    issueMessages,
    isBlockingIssue,
  };
}

export default function CartPage() {
  const router = useRouter();
  const { user } = useLiff();
  const {
    items,
    shopGroups,
    addresses,
    addressesLoading,
    selectedAddress,
    setSelectedAddress,
    removeFromCart,
    removeSellerItems,
    removeManyFromCart,
    syncCartBooks,
    clearCart,
  } = useCart();
  const { orders, createBatchOrders, isMineAsBuyer } = useV4Orders();

  const [buyNowId, setBuyNowId] = useState<string | null>(null);
  const [buyNowBook, setBuyNowBook] = useState<Book | null>(null);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowError, setBuyNowError] = useState<string | null>(null);

  const [shopsBySeller, setShopsBySeller] = useState<Record<string, ShopProfile | null>>({});
  const [loadingShops, setLoadingShops] = useState<Record<string, boolean>>({});
  const [configsBySeller, setConfigsBySeller] = useState<Record<string, ShopCheckoutConfig>>({});

  const [revalidatingBooks, setRevalidatingBooks] = useState(false);
  const [missingBookIds, setMissingBookIds] = useState<Set<string>>(new Set());
  const [priceNoticeByBookId, setPriceNoticeByBookId] = useState<Record<string, { oldPrice: number; newPrice: number }>>({});

  const [highlightedBookIds, setHighlightedBookIds] = useState<Set<string>>(new Set());
  const [highlightedSellerId, setHighlightedSellerId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const attemptKeyRef = useRef<string>(makeAttemptKey());

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('buyNow');
    setBuyNowId(param);
  }, []);

  // Load standalone book for ?buyNow=<bookId> without altering saved cart
  useEffect(() => {
    if (!buyNowId) {
      setBuyNowBook(null);
      setBuyNowError(null);
      return;
    }
    let active = true;
    setBuyNowLoading(true);
    setBuyNowError(null);
    api
      .get<BackendBookDetail>(`/api/books/${buyNowId}`)
      .then((detail) => {
        if (!active) return;
        setBuyNowBook(mapBackendBookDetailToBook(detail));
      })
      .catch((err) => {
        if (!active) return;
        setBuyNowError(err instanceof Error ? err.message : 'ไม่พบหนังสือที่ต้องการสั่งซื้อ');
      })
      .finally(() => {
        if (active) setBuyNowLoading(false);
      });
    return () => {
      active = false;
    };
  }, [buyNowId]);

  const revalidateCartBooks = useCallback(async () => {
    if (buyNowId || items.length === 0) return;
    setRevalidatingBooks(true);
    const snapshot = [...items];
    const results = await Promise.allSettled(
      snapshot.map((book) => api.get<BackendBookDetail>(`/api/books/${book.id}`))
    );

    const freshById: Record<string, Book> = {};
    const missing = new Set<string>();
    const priceDiffs: Record<string, { oldPrice: number; newPrice: number }> = {};

    results.forEach((res, idx) => {
      const original = snapshot[idx];
      if (res.status === 'fulfilled') {
        const mapped = mapBackendBookDetailToBook(res.value);
        freshById[original.id] = mapped;
        if (Math.abs(mapped.price - original.price) > 0.01) {
          priceDiffs[original.id] = { oldPrice: original.price, newPrice: mapped.price };
        }
      } else {
        const err = res.reason;
        if (err instanceof ApiError && err.status === 404) {
          missing.add(original.id);
        }
      }
    });

    if (Object.keys(freshById).length > 0) {
      syncCartBooks(freshById);
    }
    setMissingBookIds(missing);
    setPriceNoticeByBookId(priceDiffs);
    setRevalidatingBooks(false);
    // Intentionally depend on item IDs to revalidate on mount / item addition without infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNowId, items.map((b) => b.id).join(',')]);

  useEffect(() => {
    revalidateCartBooks();
  }, [revalidateCartBooks]);

  const displayGroups = useMemo<CartShopGroup[]>(() => {
    if (buyNowId) {
      if (!buyNowBook) return [];
      return [
        {
          sellerId: buyNowBook.sellerId,
          sellerName: buyNowBook.sellerName,
          items: [buyNowBook],
        },
      ];
    }
    return shopGroups;
  }, [buyNowId, buyNowBook, shopGroups]);

  const sellerIdsKey = displayGroups.map((g) => g.sellerId).join(',');

  // Fetch public shop details for every seller in view
  useEffect(() => {
    const sellerIds = displayGroups.map((g) => g.sellerId);
    const toFetch = sellerIds.filter((id) => !(id in shopsBySeller) && !loadingShops[id]);
    if (toFetch.length === 0) return;

    let active = true;
    setLoadingShops((prev) => {
      const next = { ...prev };
      toFetch.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    Promise.allSettled(
      toFetch.map((id) => api.get<BackendPublicShopResponse>(`/api/shops/${id}`))
    ).then((results) => {
      if (!active) return;
      setShopsBySeller((prev) => {
        const next = { ...prev };
        results.forEach((res, idx) => {
          const id = toFetch[idx];
          next[id] = res.status === 'fulfilled' ? mapPublicShopToShopProfile(res.value) : null;
        });
        return next;
      });
      setLoadingShops((prev) => {
        const next = { ...prev };
        toFetch.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerIdsKey]);

  const myPendingOrders = useMemo(
    () => orders.filter((o) => isMineAsBuyer(o) && o.status === 'REQUESTED'),
    [orders, isMineAsBuyer]
  );

  const pendingOrderIdBySeller = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of myPendingOrders) {
      if (o.shopId && !map.has(o.shopId)) {
        map.set(o.shopId, o.id);
      }
    }
    return map;
  }, [myPendingOrders]);

  // Ensure default config exists for every shop group
  useEffect(() => {
    setConfigsBySeller((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of displayGroups) {
        const shop = shopsBySeller[group.sellerId];
        const points = shop?.meetupPoints ?? [];
        const availableDays = shop?.availableDays?.length ? shop.availableDays : ['จ', 'อ', 'พ', 'พฤ', 'ศ'];
        const slots = expandShopHourlySlots(shop?.availableSlots ?? []);
        const dates = upcomingDates(availableDays, 6, new Date(), shop?.unavailableDates ?? []);
        const bookedSlots = shop?.bookedPickupSlots ?? [];
        const firstFree = findFirstFreeDateAndSlot(dates, slots, bookedSlots);

        const existing = next[group.sellerId];
        if (!existing) {
          changed = true;
          next[group.sellerId] = {
            selected: true,
            method: group.items.every((b) => b.deliveryMethods.includes('MEETUP')) ? 'MEETUP' : 'PARCEL',
            pointId: points[0]?.id ?? '',
            dateISO: firstFree?.dateISO ?? dates[0]?.iso ?? '',
            slot: firstFree?.slot ?? slots[0] ?? '',
          };
        } else {
          const updated = { ...existing };
          let itemChanged = false;
          if (points.length > 0 && !points.some((p) => p.id === existing.pointId)) {
            updated.pointId = points[0].id;
            itemChanged = true;
          }
          if (dates.length > 0 && !dates.some((d) => d.iso === existing.dateISO)) {
            updated.dateISO = firstFree?.dateISO ?? dates[0].iso;
            itemChanged = true;
          }
          if (slots.length > 0 && !slots.includes(existing.slot)) {
            updated.slot = firstFree?.slot ?? slots[0];
            itemChanged = true;
          }
          if (
            updated.dateISO &&
            updated.slot &&
            isSlotBookedForDate(updated.dateISO, updated.slot, bookedSlots) &&
            firstFree
          ) {
            updated.dateISO = firstFree.dateISO;
            updated.slot = firstFree.slot;
            itemChanged = true;
          }
          if (itemChanged) {
            next[group.sellerId] = updated;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [displayGroups, shopsBySeller]);

  const updateShopConfig = (sellerId: string, patch: Partial<ShopCheckoutConfig>) => {
    attemptKeyRef.current = makeAttemptKey();
    setSubmitError(null);
    setHighlightedSellerId(null);
    setHighlightedBookIds(new Set());
    setConfigsBySeller((prev) => ({
      ...prev,
      [sellerId]: {
        ...(prev[sellerId] ?? {
          selected: true,
          method: 'MEETUP',
          pointId: '',
          dateISO: '',
          slot: '',
        }),
        ...patch,
      },
    }));
  };

  const validationsBySeller = useMemo(() => {
    const out: Record<string, ShopValidationResult> = {};
    for (const group of displayGroups) {
      const isLoading = !(group.sellerId in shopsBySeller) || Boolean(loadingShops[group.sellerId]);
      out[group.sellerId] = evaluateShopGroup(
        group,
        shopsBySeller[group.sellerId],
        isLoading,
        configsBySeller[group.sellerId],
        missingBookIds,
        pendingOrderIdBySeller,
        user?.id
      );
    }
    return out;
  }, [displayGroups, shopsBySeller, loadingShops, configsBySeller, missingBookIds, pendingOrderIdBySeller, user?.id]);

  const selectedGroups = useMemo(
    () =>
      displayGroups.filter((group) =>
        buyNowId ? true : configsBySeller[group.sellerId]?.selected !== false
      ),
    [displayGroups, buyNowId, configsBySeller]
  );

  // Reset idempotency key if checked-out book IDs or address change
  const selectionSignature = selectedGroups
    .map((g) => `${g.sellerId}:${g.items.map((i) => `${i.id}@${i.price}`).join(',')}`)
    .join('|');
  useEffect(() => {
    attemptKeyRef.current = makeAttemptKey();
  }, [selectionSignature, selectedAddress?.id]);

  const anySelectedUsesParcel = selectedGroups.some(
    (g) => validationsBySeller[g.sellerId]?.delivery === 'PARCEL'
  );
  const missingParcelAddress = anySelectedUsesParcel && !selectedAddress;

  const hasAnySelectedBlockingIssue = selectedGroups.some(
    (g) => validationsBySeller[g.sellerId]?.isBlockingIssue
  );

  const exceedsQuota = myPendingOrders.length + selectedGroups.length > MAX_PENDING_ORDERS;

  const totals = useMemo(() => {
    let bookSubtotal = 0;
    let shippingSubtotal = 0;
    let totalBooks = 0;
    for (const group of selectedGroups) {
      const validation = validationsBySeller[group.sellerId];
      const shop = shopsBySeller[group.sellerId];
      const groupBookSum = group.items.reduce((s, b) => s + b.price, 0);
      const fee =
        validation?.delivery === 'PARCEL'
          ? calcParcelFee(group.items.length, shop?.province, selectedAddress?.province)
          : 0;
      bookSubtotal += groupBookSum;
      shippingSubtotal += fee;
      totalBooks += group.items.length;
    }
    return {
      bookSubtotal,
      shippingSubtotal,
      grandTotal: bookSubtotal + shippingSubtotal,
      totalBooks,
    };
  }, [selectedGroups, validationsBySeller, shopsBySeller, selectedAddress?.province]);

  const handleSubmit = async () => {
    if (selectedGroups.length === 0 || hasAnySelectedBlockingIssue) return;
    if (exceedsQuota) {
      setSubmitError(
        `คำขอซื้อรอตอบรับรวมเกินโควต้า ${MAX_PENDING_ORDERS} ออเดอร์ (ค้างอยู่ ${myPendingOrders.length} ออเดอร์) กรุณาเลือกไม่เกิน ${Math.max(0, MAX_PENDING_ORDERS - myPendingOrders.length)} ร้าน`
      );
      return;
    }
    if (missingParcelAddress) {
      setSubmitError('กรุณาเพิ่มหรือเลือกที่อยู่จัดส่งสำหรับร้านที่เลือกส่งพัสดุ');
      return;
    }

    setSubmitError(null);
    setHighlightedBookIds(new Set());
    setHighlightedSellerId(null);
    setIsSubmitting(true);

    try {
      const payloads: CreateOrderInput[] = selectedGroups.map((group) => {
        const shop = shopsBySeller[group.sellerId];
        const validation = validationsBySeller[group.sellerId];
        const cfg = configsBySeller[group.sellerId];
        const delivery = validation.delivery!;
        const groupBookTotal = group.items.reduce((s, b) => s + b.price, 0);
        const shippingFee =
          delivery === 'PARCEL'
            ? calcParcelFee(group.items.length, shop?.province, selectedAddress?.province)
            : 0;
        const point = validation.points.find((p) => p.id === cfg?.pointId) ?? validation.points[0];

        return {
          delivery,
          shopId: group.sellerId,
          shop: {
            shopName: shop?.shopName ?? group.sellerName ?? 'ร้านหนังสือ',
            avatar: shop?.avatar ?? group.items[0].sellerAvatar,
            rating: shop?.rating ?? group.items[0].sellerRating,
            completedSales: shop?.completedSales ?? 0,
            payeeVerified: shop?.payeeVerified ?? group.items[0].isPromptPayVerified,
          },
          books: group.items.map((book) => ({
            id: book.id,
            title: book.title,
            author: book.author,
            cover: book.photos.cover,
            grade: toV4Grade(book.grade),
            price: book.price,
          })),
          shippingFee,
          expectedTotal: groupBookTotal + shippingFee,
          schedule:
            delivery === 'MEETUP' && point
              ? {
                  dateISO: cfg?.dateISO || validation.dates[0]?.iso || '',
                  timeLabel: cfg?.slot || validation.slots[0] || '',
                  lat: point.lat,
                  lng: point.lng,
                  landmark: point.name,
                  proposedBy: 'BUYER',
                  confirmedByBuyer: true,
                }
              : undefined,
          shipping:
            delivery === 'PARCEL' && selectedAddress
              ? {
                  province: selectedAddress.province,
                  receiverName: selectedAddress.fullName,
                  receiverAddress: `${selectedAddress.detail} ${selectedAddress.subdistrict} ${selectedAddress.district} ${selectedAddress.province} ${selectedAddress.postalCode}`,
                }
              : undefined,
          shipWithinDays: shop ? shipDeadlineDays(shop.shipMode, shop.shipWithinDays) : 2,
        };
      });

      const createdIds = await createBatchOrders(payloads, attemptKeyRef.current);

      if (!buyNowId) {
        const checkedOutBookIds = selectedGroups.flatMap((g) => g.items.map((b) => b.id));
        removeManyFromCart(checkedOutBookIds);
      }

      attemptKeyRef.current = makeAttemptKey();
      router.push(`/cart/success?ids=${encodeURIComponent(createdIds.join(','))}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        const details = err.details as
          | { sellerId?: string; invalidBookIds?: string[] }
          | undefined;
        if (details?.sellerId) setHighlightedSellerId(details.sellerId);
        if (Array.isArray(details?.invalidBookIds)) {
          setHighlightedBookIds(new Set(details.invalidBookIds));
        }
        if (err.code === 'PRICE_CHANGED' || err.code === 'BOOK_NOT_AVAILABLE') {
          revalidateCartBooks();
        }
      } else {
        setSubmitError(err instanceof Error ? err.message : 'ส่งคำขอซื้อไม่สำเร็จ');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (buyNowId && buyNowLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="สั่งซื้อทันที" />
        <div className="p-4 space-y-3">
          <div className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="h-44 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (buyNowId && (buyNowError || !buyNowBook)) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="สั่งซื้อทันที" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 w-full text-center">
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-slate-400" />}
              title="ไม่สามารถสั่งซื้อเล่มนี้ได้"
              description={buyNowError || 'ไม่พบข้อมูลหนังสือในระบบ'}
              actionText="กลับหน้าหลัก"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  if (buyNowId && buyNowBook && user?.id && buyNowBook.sellerId === user.id) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="สั่งซื้อทันที" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 w-full text-center">
            <EmptyState
              icon={<Store className="w-10 h-10 text-amber-500" />}
              title="ไม่สามารถสั่งซื้อหนังสือของตัวเองได้"
              description="รายการนี้เป็นหนังสือจากร้านของคุณเอง ระบบไม่อนุญาตให้ส่งคำขอซื้อสินค้าของตนเอง"
              actionText="กลับไปหน้าหนังสือ"
              onAction={() => router.push(`/book/${buyNowBook.id}`)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!buyNowId && displayGroups.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 select-none">
        <TopBar title="ตะกร้าสินค้า" />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 w-full text-center">
            <EmptyState
              icon={<ShoppingBag className="w-10 h-10 text-slate-400" />}
              title="ไม่มีหนังสือในตะกร้า"
              description="เลือกดูหนังสือที่คุณสนใจ สามารถเพิ่มได้หลายร้านพร้อมกัน"
              actionText="ไปค้นหาหนังสือ"
              onAction={() => router.push('/')}
            />
          </div>
        </div>
      </div>
    );
  }

  const priceChangesCount = Object.keys(priceNoticeByBookId).length;
  const disableSubmit =
    selectedGroups.length === 0 ||
    hasAnySelectedBlockingIssue ||
    missingParcelAddress ||
    exceedsQuota;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 select-none pb-40">
      <TopBar
        title={buyNowId ? 'ส่งคำขอซื้อทันที' : 'ตะกร้าและส่งคำขอซื้อ'}
        subtitle={
          buyNowId
            ? 'สั่งซื้อเฉพาะเล่มนี้ (ไม่ปนกับตะกร้าเดิม)'
            : `${displayGroups.length} ร้านค้า · ${items.length} เล่ม`
        }
        rightAction={
          !buyNowId && items.length > 0 ? (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-semibold text-slate-400 hover:text-rose-500 px-2 py-1"
            >
              ล้างตะกร้า
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-4">
        {/* Quota & price notices */}
        {myPendingOrders.length > 0 && (
          <div
            className={clsx(
              'p-3 rounded-2xl border text-xs flex items-start gap-2',
              exceedsQuota
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            )}
          >
            <Hourglass className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              คุณมีคำขอซื้อที่รอร้านค้าตอบรับอยู่ <strong>{myPendingOrders.length}/{MAX_PENDING_ORDERS}</strong> ออเดอร์
              {exceedsQuota
                ? ` · เลือกเพิ่มได้อีก ${Math.max(0, MAX_PENDING_ORDERS - myPendingOrders.length)} ร้านเท่านั้น`
                : ''}
            </span>
          </div>
        )}

        {(priceChangesCount > 0 || revalidatingBooks) && (
          <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <RefreshCw className={clsx('w-3.5 h-3.5 shrink-0', revalidatingBooks && 'animate-spin')} />
              {revalidatingBooks
                ? 'กำลังตรวจสอบสถานะและราคาล่าสุด...'
                : `อัปเดตราคาล่าสุดจากร้านค้าแล้ว ${priceChangesCount} เล่ม กรุณาตรวจสอบยอดก่อนยืนยัน`}
            </span>
          </div>
        )}

        {/* Shop Cards */}
        {displayGroups.map((group) => {
          const shop = shopsBySeller[group.sellerId];
          const isShopLoading = !(group.sellerId in shopsBySeller) || Boolean(loadingShops[group.sellerId]);
          const validation = validationsBySeller[group.sellerId];
          const cfg = configsBySeller[group.sellerId];
          const isSelected = buyNowId ? true : cfg?.selected !== false;
          const isHighlightedSeller = highlightedSellerId === group.sellerId;

          const parcelFee = calcParcelFee(
            group.items.length,
            shop?.province,
            selectedAddress?.province
          );
          const groupBookSum = group.items.reduce((s, b) => s + b.price, 0);
          const groupTotal =
            groupBookSum + (validation.delivery === 'PARCEL' ? parcelFee : 0);
          const selectedPoint =
            validation.points.find((p) => p.id === cfg?.pointId) ?? validation.points[0];

          return (
            <section
              key={group.sellerId}
              className={clsx(
                'bg-white rounded-2xl border p-4 space-y-3 transition',
                isHighlightedSeller
                  ? 'border-rose-400 ring-2 ring-rose-200'
                  : isSelected
                    ? 'border-slate-200'
                    : 'border-slate-200 opacity-65'
              )}
            >
              {/* Shop Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!buyNowId && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        updateShopConfig(group.sellerId, { selected: e.target.checked })
                      }
                      aria-label={`เลือกสั่งร้าน ${shop?.shopName ?? group.sellerName}`}
                      className="w-4 h-4 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                  )}
                  <Store className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="font-bold text-sm text-slate-900 truncate">
                    {shop?.shopName ?? group.sellerName}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    ({group.items.length} เล่ม)
                  </span>
                </div>
                {!buyNowId && (
                  <button
                    type="button"
                    onClick={() => removeSellerItems(group.sellerId)}
                    className="text-[11px] text-slate-400 hover:text-rose-500 shrink-0"
                  >
                    ลบร้านนี้
                  </button>
                )}
              </div>

              {/* Validation Issues for this Shop */}
              {validation.issueMessages.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-900">
                  {validation.issueMessages.map((msg) => (
                    <p key={msg} className="flex items-start gap-1.5 leading-relaxed">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                      <span>{msg}</span>
                    </p>
                  ))}
                  {validation.existingPendingOrderId && (
                    <Link
                      href={`/orders/${validation.existingPendingOrderId}`}
                      className="inline-block text-[11px] font-bold text-[var(--color-primary)] underline mt-1"
                    >
                      ดูคำขอซื้อเดิมที่รอร้านอนุมัติ →
                    </Link>
                  )}
                </div>
              )}

              {/* Books in Shop */}
              <div className="divide-y divide-slate-100">
                {group.items.map((book) => {
                  const isUnavailable = validation.unavailableBookIds.has(book.id);
                  const isNonCod = validation.nonCodBookIds.has(book.id);
                  const isConflict = validation.conflictingBookIds.has(book.id);
                  const isServerInvalid = highlightedBookIds.has(book.id);
                  const priceDiff = priceNoticeByBookId[book.id];
                  const hasBadge = isUnavailable || isNonCod || isConflict || isServerInvalid;

                  return (
                    <div
                      key={book.id}
                      className={clsx(
                        'py-3 flex gap-3 items-center rounded-xl transition',
                        hasBadge && 'bg-rose-50/60 px-2 -mx-2'
                      )}
                    >
                      <img
                        src={book.photos.cover}
                        alt={book.title}
                        className="w-12 h-16 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">
                          {book.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span>เกรด {book.grade}</span>
                          <span>·</span>
                          <span>
                            {book.deliveryMethods.includes('MEETUP') && book.deliveryMethods.includes('PARCEL')
                              ? 'นัดรับ / พัสดุ'
                              : book.deliveryMethods.includes('MEETUP')
                                ? 'นัดรับเท่านั้น'
                                : 'ส่งพัสดุเท่านั้น'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm font-bold text-[var(--color-primary)]">
                            ฿{book.price.toLocaleString()}
                          </span>
                          {priceDiff && (
                            <span className="text-[11px] line-through text-slate-400">
                              ฿{priceDiff.oldPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {hasBadge && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {isUnavailable && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                ไม่พร้อมขายแล้ว
                              </span>
                            )}
                            {isNonCod && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                ไม่รองรับเก็บเงินปลายทาง
                              </span>
                            )}
                            {isConflict && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                วิธีจัดส่งขัดแย้งกับเล่มอื่น
                              </span>
                            )}
                            {isServerInvalid && !isUnavailable && !isNonCod && !isConflict && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                รายการมีปัญหา กรุณาตรวจสอบ
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {!buyNowId && (
                        <button
                          type="button"
                          onClick={() => removeFromCart(book.id)}
                          aria-label={`ลบ ${book.title}`}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-full hover:bg-white shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Per-Shop Delivery Controls */}
              {isSelected && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  {isShopLoading ? (
                    <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <MethodCard
                          active={validation.delivery === 'MEETUP'}
                          disabled={!validation.canMeetup}
                          onClick={() => updateShopConfig(group.sellerId, { method: 'MEETUP' })}
                          icon={<MapPin className="w-4 h-4" />}
                          title="นัดรับ"
                          price="ฟรี"
                          note={
                            validation.canMeetup
                              ? `${validation.points.length} จุดที่ร้านตั้งไว้`
                              : validation.points.length === 0
                                ? 'ร้านยังไม่ตั้งจุดนัดรับ'
                                : 'หนังสือบางเล่มไม่สะดวกนัดรับ'
                          }
                        />
                        <MethodCard
                          active={validation.delivery === 'PARCEL'}
                          disabled={!validation.canParcel}
                          onClick={() => updateShopConfig(group.sellerId, { method: 'PARCEL' })}
                          icon={<Truck className="w-4 h-4" />}
                          title="ส่งพัสดุ"
                          price={validation.canParcel ? `฿${parcelFee}` : '—'}
                          note={
                            validation.canParcel
                              ? shop?.province
                                ? `ส่งจาก${shop.province}`
                                : 'ระบบคำนวณค่าส่ง'
                              : 'ร้านยังไม่เปิดส่งพัสดุ'
                          }
                        />
                      </div>

                      {validation.delivery === 'MEETUP' && validation.points.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">จุดนัดรับของร้าน</span>
                              <span className="text-[10px] text-slate-400">ผู้ขายเป็นคนกำหนดจุด</span>
                            </div>
                            <div role="radiogroup" aria-label={`จุดนัดรับ ${group.sellerName}`} className="space-y-1.5">
                              {validation.points.map((p) => {
                                const selected = p.id === selectedPoint?.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => updateShopConfig(group.sellerId, { pointId: p.id })}
                                    className={clsx(
                                      'w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition',
                                      selected
                                        ? 'border-[var(--color-primary)] bg-emerald-50 ring-1 ring-[var(--color-primary)]/20'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    )}
                                  >
                                    <span
                                      className={clsx(
                                        'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                                        selected ? 'border-[var(--color-primary)]' : 'border-slate-300'
                                      )}
                                    >
                                      {selected && (
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                                      )}
                                    </span>
                                    <span className="flex-1 text-xs">
                                      <span className="font-semibold text-slate-800">{p.name}</span>
                                      <span className="block text-[11px] text-slate-400 mt-0.5">
                                        {p.province}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {selectedPoint && (
                            <div className="rounded-xl overflow-hidden border border-slate-200">
                              <iframe
                                key={selectedPoint.id}
                                title={`แผนที่ ${selectedPoint.name}`}
                                src={mapEmbedUrl(selectedPoint.lat, selectedPoint.lng)}
                                className="w-full h-36 border-0 block"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                              <a
                                href={mapDirectionsUrl(selectedPoint.lat, selectedPoint.lng)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 py-2 bg-white text-xs font-semibold text-[var(--color-primary-dark)] hover:bg-slate-50 border-t border-slate-200"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                เปิดใน Google Maps
                              </a>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              วันที่ผู้ขายสะดวก
                            </span>
                            {validation.dates.length === 0 ? (
                              <p className="text-[11px] text-rose-600">
                                ไม่มีวันที่เปิดรับนัดในขณะนี้
                              </p>
                            ) : (
                              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                {validation.dates.map((d) => {
                                  const dayFullyBooked = validation.slots.every((s) =>
                                    isSlotBookedForDate(d.iso, s, validation.bookedSlots)
                                  );
                                  const activeDate =
                                    cfg?.dateISO || validation.dates[0]?.iso;
                                  return (
                                    <Pill
                                      key={d.iso}
                                      disabled={dayFullyBooked}
                                      selected={d.iso === activeDate}
                                      onClick={() => {
                                        const currentSlot =
                                          cfg?.slot || validation.slots[0] || '';
                                        const nextFreeSlot =
                                          currentSlot &&
                                          !isSlotBookedForDate(
                                            d.iso,
                                            currentSlot,
                                            validation.bookedSlots
                                          )
                                            ? currentSlot
                                            : validation.slots.find(
                                                (s) =>
                                                  !isSlotBookedForDate(
                                                    d.iso,
                                                    s,
                                                    validation.bookedSlots
                                                  )
                                              ) ?? currentSlot;
                                        updateShopConfig(group.sellerId, {
                                          dateISO: d.iso,
                                          slot: nextFreeSlot,
                                        });
                                      }}
                                    >
                                      {d.label}
                                      {dayFullyBooked ? ' (เต็ม)' : ''}
                                    </Pill>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                <Clock className="w-4 h-4 text-slate-400" />
                                ช่วงเวลานัดรับ (1 ชม./คิว)
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ล็อกเวลาที่ร้านมีนัดแล้ว
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {validation.slots.map((s) => {
                                const activeDate =
                                  cfg?.dateISO || validation.dates[0]?.iso || '';
                                const booked = isSlotBookedForDate(
                                  activeDate,
                                  s,
                                  validation.bookedSlots
                                );
                                return (
                                  <Pill
                                    key={s}
                                    disabled={booked}
                                    selected={
                                      !booked && s === (cfg?.slot || validation.slots[0])
                                    }
                                    onClick={() =>
                                      updateShopConfig(group.sellerId, { slot: s })
                                    }
                                  >
                                    {s}
                                    {booked ? ' (มีนัดแล้ว)' : ''}
                                  </Pill>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {validation.delivery === 'PARCEL' && (
                        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                          <Truck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                          <span>
                            ผู้ขายยืนยันการส่ง · เก็บเงินปลายทาง
                            {shop?.province ? ` · ส่งจาก${shop.province}` : ''} · ค่าส่ง ฿{parcelFee}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500">รวมยอดร้านนี้</span>
                        <span className="font-black text-slate-900">
                          ฿{groupTotal.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* Shared Parcel Delivery Address (when any selected shop uses PARCEL) */}
        {anySelectedUsesParcel && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-slate-400" />
                ที่อยู่จัดส่งพัสดุ (ใช้ร่วมกันสำหรับร้านที่เลือกส่งพัสดุ)
              </h3>
            </div>
            {selectedAddress ? (
              <button
                type="button"
                onClick={() => setIsAddressSheetOpen(true)}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-left text-xs space-y-1"
              >
                <span className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">ส่งถึง: {selectedAddress.fullName}</span>
                  <span className="text-[var(--color-primary)] font-semibold">เปลี่ยน</span>
                </span>
                <span className="block text-slate-500 leading-snug">
                  {selectedAddress.detail} {selectedAddress.subdistrict} {selectedAddress.district}{' '}
                  {selectedAddress.province} {selectedAddress.postalCode}
                </span>
              </button>
            ) : (
              <Link
                href={buyNowId ? `/addresses/edit?next=${encodeURIComponent(`/cart?buyNow=${buyNowId}`)}` : '/addresses/edit?next=/cart'}
                className="block w-full p-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100/70 text-left text-xs space-y-1"
              >
                <span className="block font-bold text-amber-900">
                  {addressesLoading ? 'กำลังโหลดที่อยู่จัดส่ง...' : 'ยังไม่มีที่อยู่จัดส่ง'}
                </span>
                <span className="block text-amber-700">
                  แตะเพื่อเพิ่มที่อยู่สำหรับส่งพัสดุ →
                </span>
              </Link>
            )}
          </section>
        )}

        {/* Total Summary */}
        {selectedGroups.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>จำนวนร้านค้าที่เลือก</span>
              <span className="font-semibold text-slate-800">{selectedGroups.length} ร้าน ({totals.totalBooks} เล่ม)</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ค่าหนังสือรวม</span>
              <span className="font-semibold text-slate-800">฿{totals.bookSubtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>ค่าจัดส่งรวม</span>
              <span className="font-semibold text-slate-800">
                {totals.shippingSubtotal === 0 ? 'ฟรี' : `฿${totals.shippingSubtotal.toLocaleString()}`}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline text-sm">
              <span className="font-bold text-slate-900">ยอดรวมทั้งหมด</span>
              <span className="text-xl font-black text-[var(--color-primary)]">
                ฿{totals.grandTotal.toLocaleString()}
              </span>
            </div>
            {selectedGroups.length > 1 && (
              <p className="text-[11px] text-slate-400 pt-1">
                ระบบจะแยกสร้าง {selectedGroups.length} ออเดอร์ตามร้านค้าพร้อมกัน (หากร้านใดมีปัญหา จะไม่สร้างออเดอร์ค้างบางส่วน)
              </p>
            )}
          </section>
        )}

        {/* What happens next */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-700">หลังส่งคำขอ</h3>
          <ol className="space-y-1.5 text-[11px] text-slate-600">
            <li className="flex gap-2">
              <Hourglass className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              ผู้ขายแต่ละร้านต้องตอบรับคำขอก่อน (ภายใน 24 ชม.)
            </li>
            <li className="flex gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              รับแล้ว → แชทในออเดอร์เปิดเพื่อนัดรับหรือจัดส่งพัสดุ
            </li>
            <li className="flex gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ตรวจสอบสภาพหนังสือเมื่อได้รับ แล้วจ่ายเงินปลายทาง/หน้างาน
            </li>
          </ol>
        </section>
      </div>

      <BottomSheet
        isOpen={isAddressSheetOpen}
        onClose={() => setIsAddressSheetOpen(false)}
        title="เลือกที่อยู่จัดส่ง"
      >
        <div className="space-y-2 py-2">
          {addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => {
                setSelectedAddress(addr);
                setIsAddressSheetOpen(false);
              }}
              className={clsx(
                'w-full text-left p-3.5 rounded-xl border',
                selectedAddress?.id === addr.id
                  ? 'border-[var(--color-primary)] bg-emerald-50/60'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                <span>{addr.fullName}</span>
                <span className="text-[10px] font-medium text-slate-400">{addr.province}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{addr.detail}</p>
            </button>
          ))}
          <Link
            href={buyNowId ? `/addresses/edit?next=${encodeURIComponent(`/cart?buyNow=${buyNowId}`)}` : '/addresses/edit?next=/cart'}
            className="block text-center text-xs font-bold text-[var(--color-primary)] py-2"
          >
            + เพิ่มที่อยู่ใหม่
          </Link>
        </div>
      </BottomSheet>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center pointer-events-none">
        <div className="w-full max-w-[430px] bg-white border-t border-slate-200 p-3 pointer-events-auto safe-area-bottom shadow-lg space-y-2">
          {submitError ? (
            <p className="text-[11px] font-semibold text-rose-600 text-center leading-snug">
              {submitError}
            </p>
          ) : (
            <p className="flex items-center justify-center gap-1 text-[10px] text-slate-400 text-center">
              <Info className="w-3 h-3" />
              ยังไม่ต้องจ่ายเงินตอนนี้ · รอผู้ขายตอบรับก่อน
            </p>
          )}
          <Button
            fullWidth
            size="lg"
            isLoading={isSubmitting}
            disabled={disableSubmit}
            onClick={handleSubmit}
          >
            {selectedGroups.length === 0
              ? 'กรุณาเลือกอย่างน้อย 1 ร้านค้า'
              : `ส่งคำขอซื้อ (${selectedGroups.length} ร้าน) · ฿${totals.grandTotal.toLocaleString()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  price,
  note,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  price: string;
  note: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'p-3 rounded-2xl border flex flex-col items-start gap-1 text-left transition',
        active
          ? 'border-[var(--color-primary)] bg-emerald-50 ring-2 ring-[var(--color-primary)]/15'
          : 'border-slate-200 hover:bg-slate-50',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      <span
        className={clsx(
          'flex items-center gap-1.5 text-xs font-bold',
          active ? 'text-emerald-800' : 'text-slate-700'
        )}
      >
        {icon}
        {title}
      </span>
      <span className="text-sm font-black text-slate-900">{price}</span>
      <span className="text-[10px] text-slate-500 text-left">{note}</span>
    </button>
  );
}

function Pill({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition',
        disabled
          ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed line-through'
          : selected
            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  );
}
