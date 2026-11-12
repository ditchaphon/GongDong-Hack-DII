'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ListingDraft, ListingStatus, SellerListing, SellerOrder } from '@/types';
import { CreditEntry } from '@/types/v4';
import { MOCK_SELLER_LISTINGS, MOCK_SELLER_ORDERS } from '@/mocks/seller';
import { MOCK_V4_LEDGER } from '@/mocks/v4';
import { useLiff } from '@/hooks/useLiff';

/** Public shop identity + delivery settings. No real name, phone or bank data. */
export interface ShopSettings {
  shopName: string;
  avatar?: string;
  meetupZones: string[];
  supportsParcel: boolean;
  parcelFee: number;
  /** Payout verification is admin-only data; buyers only see a badge. */
  payeeVerified: boolean;
  setupComplete: boolean;
}

export interface PendingTopUp {
  packId: string;
  credits: number;
  price: number;
  submittedAt: string;
}

export interface SellerContextValue {
  shop: ShopSettings | null;
  isShopSetup: boolean;
  saveShop: (settings: Omit<ShopSettings, 'setupComplete' | 'payeeVerified'>) => void;
  verifyPayee: () => void;
  credits: number;
  addCredits: (amount: number) => void;
  ledger: CreditEntry[];
  pendingTopUp: PendingTopUp | null;
  submitTopUp: (pack: { id: string; credits: number; price: number }) => void;
  approveTopUp: () => void;
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  orders: SellerOrder[];
  listings: SellerListing[];
  acceptOrder: (orderId: string) => { success: boolean; message?: string };
  rejectOrder: (orderId: string) => void;
  closeSale: (orderId: string) => void;
  publishListing: (draft: ListingDraft) => SellerListing;
  updateListing: (id: string, patch: Partial<SellerListing>) => void;
  setListingStatus: (id: string, status: ListingStatus) => void;
}

const SellerContext = createContext<SellerContextValue | null>(null);

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';

const DEFAULT_ZONES = ['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.'];

export const SellerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, deductCredit, addCredits } = useLiff();

  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>(MOCK_SELLER_ORDERS);
  const [listings, setListings] = useState<SellerListing[]>(MOCK_SELLER_LISTINGS);
  const [selectedPackageId, setSelectedPackageId] = useState('bookworm');
  const [pendingTopUp, setPendingTopUp] = useState<PendingTopUp | null>(null);
  const [ledger, setLedger] = useState<CreditEntry[]>(MOCK_V4_LEDGER);

  const isShopSetup = !!shop?.setupComplete;

  const saveShop = (
    settings: Omit<ShopSettings, 'setupComplete' | 'payeeVerified'>
  ) => {
    setShop((prev) => ({
      ...settings,
      payeeVerified: prev?.payeeVerified ?? false,
      setupComplete: true,
    }));
  };

  const verifyPayee = () => {
    setShop((prev) =>
      prev ? { ...prev, payeeVerified: true } : prev
    );
  };

  const acceptOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'ไม่พบออเดอร์นี้' };
    if (order.status !== 'PENDING_ACCEPT') {
      return { success: false, message: 'ออเดอร์นี้ถูกรับไปแล้ว' };
    }
    if (user.credits < 1) {
      return { success: false, message: 'เครดิตไม่พอ กรุณาเติมเครดิตก่อนรับออเดอร์' };
    }
    deductCredit(1);
    setLedger((prev) => [
      {
        id: `credit-${prev.length + 1}`,
        atISO: new Date().toISOString(),
        reason: 'ACCEPT_ORDER',
        delta: -1,
        balanceAfter: user.credits - 1,
        orderId,
      },
      ...prev,
    ]);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'WAITING_PAYMENT',
              acceptedAt: 'เมื่อสักครู่',
            }
          : o
      )
    );
    return { success: true };
  };

  const rejectOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
    );
  };

  const closeSale = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'COMPLETED' } : o))
    );
  };

  const publishListing = (draft: ListingDraft): SellerListing => {
    const shopName = shop?.shopName || user.displayName;
    const allowedDelivery = shop?.payeeVerified
      ? draft.deliveryMethods
      : draft.deliveryMethods.filter((method) => method === 'MEETUP');

    const listing: SellerListing = {
      id: `listing-${Date.now()}`,
      title: draft.title,
      author: draft.author,
      publisher: draft.publisher || undefined,
      isbn: draft.isbn || undefined,
      isSet: draft.mode === 'SET',
      totalVolumes: draft.mode === 'SET' ? draft.totalVolumes : undefined,
      price: draft.price,
      originalPrice: draft.originalPrice || undefined,
      grade: ((): SellerListing['grade'] => {
        const passed = Object.values(draft.checklist).filter(Boolean).length;
        const defects = 5 - passed;
        if (defects === 0) return 'A';
        if (defects === 1) return 'B';
        if (defects === 2) return 'C';
        return 'D';
      })(),
      checklist: draft.checklist,
      photos: {
        cover: draft.photos.cover || FALLBACK_COVER,
        back: draft.photos.back || FALLBACK_COVER,
        spine: draft.photos.spine || FALLBACK_COVER,
        nameTag: draft.photos.nameTag || FALLBACK_COVER,
        defects: draft.photos.defects,
      },
      sellerId: user.id,
      sellerName: shopName,
      sellerRating: 4.9,
      sellerAvatar: shop?.avatar || user.pictureUrl,
      isPromptPayVerified: shop?.payeeVerified ?? false,
      deliveryMethods: allowedDelivery.length ? allowedDelivery : ['MEETUP'],
      parcelShippingFee: allowedDelivery.includes('PARCEL')
        ? draft.parcelShippingFee
        : undefined,
      meetupZones: shop?.meetupZones?.length ? shop.meetupZones : DEFAULT_ZONES,
      createdAt: 'เมื่อสักครู่',
      status: 'ACTIVE',
      views: 0,
      savedCount: 0,
    };

    setListings((prev) => [listing, ...prev]);
    return listing;
  };

  const updateListing = (id: string, patch: Partial<SellerListing>) => {
    setListings((prev) =>
      prev.map((listing) => (listing.id === id ? { ...listing, ...patch } : listing))
    );
  };

  const setListingStatus = (id: string, status: ListingStatus) => {
    updateListing(id, { status });
  };

  const submitTopUp = (pack: { id: string; credits: number; price: number }) => {
    setPendingTopUp({
      packId: pack.id,
      credits: pack.credits,
      price: pack.price,
      submittedAt: new Date().toISOString(),
    });
  };

  const approveTopUp = () => {
    if (!pendingTopUp) return;
    addCredits(pendingTopUp.credits);
    setLedger((prev) => [
      {
        id: `credit-${prev.length + 1}`,
        atISO: new Date().toISOString(),
        reason: 'TOPUP',
        delta: pendingTopUp.credits,
        balanceAfter: user.credits + pendingTopUp.credits,
        note: `แพ็กเกจ ${pendingTopUp.packId} · อนุมัติสลิปแล้ว`,
      },
      ...prev,
    ]);
    setPendingTopUp(null);
  };

  return (
    <SellerContext.Provider
      value={{
        shop,
        isShopSetup,
        saveShop,
        verifyPayee,
        credits: user.credits,
        addCredits,
        ledger,
        pendingTopUp,
        submitTopUp,
        approveTopUp,
        selectedPackageId,
        setSelectedPackageId,
        orders,
        listings,
        acceptOrder,
        rejectOrder,
        closeSale,
        publishListing,
        updateListing,
        setListingStatus,
      }}
    >
      {children}
    </SellerContext.Provider>
  );
};

export function useSeller(): SellerContextValue {
  const ctx = useContext(SellerContext);
  if (!ctx) throw new Error('useSeller must be used within a <SellerProvider>');
  return ctx;
}
