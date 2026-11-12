'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ListingDraft, SellerListing, SellerOrder } from '@/types';
import { MOCK_SELLER_LISTINGS, MOCK_SELLER_ORDERS } from '@/mocks/seller';
import { useLiff } from '@/hooks/useLiff';

export interface SellerIdentity {
  phone: string;
  promptPayName: string;
  bankName: string;
  bankAccount: string;
}

export interface SellerContextValue {
  isVerified: boolean;
  identity: SellerIdentity | null;
  verifySeller: (identity: SellerIdentity) => void;
  credits: number;
  addCredits: (amount: number) => void;
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  orders: SellerOrder[];
  listings: SellerListing[];
  acceptOrder: (orderId: string) => { success: boolean; message?: string };
  rejectOrder: (orderId: string) => void;
  closeSale: (orderId: string) => void;
  publishListing: (draft: ListingDraft) => SellerListing;
}

const SellerContext = createContext<SellerContextValue | null>(null);

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';

export const SellerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, deductCredit, addCredits } = useLiff();

  const [isVerified, setIsVerified] = useState(false);
  const [identity, setIdentity] = useState<SellerIdentity | null>(null);
  const [orders, setOrders] = useState<SellerOrder[]>(MOCK_SELLER_ORDERS);
  const [listings, setListings] = useState<SellerListing[]>(MOCK_SELLER_LISTINGS);
  const [selectedPackageId, setSelectedPackageId] = useState('bookworm');

  const verifySeller = (next: SellerIdentity) => {
    setIdentity(next);
    setIsVerified(true);
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
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'WAITING_PAYMENT',
              acceptedAt: 'เมื่อสักครู่',
              buyerPhone: o.buyerPhone || '086-555-1234',
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
      sellerName: user.displayName,
      sellerRating: 4.9,
      sellerAvatar: user.pictureUrl,
      isPromptPayVerified: isVerified,
      deliveryMethods: draft.deliveryMethods,
      parcelShippingFee: draft.deliveryMethods.includes('PARCEL')
        ? draft.parcelShippingFee
        : undefined,
      meetupZones: draft.deliveryMethods.includes('MEETUP')
        ? ['หน้าหอสมุดกลาง มช.', 'ประตูหน้า มช.']
        : undefined,
      createdAt: 'เมื่อสักครู่',
      status: 'ACTIVE',
      views: 0,
      savedCount: 0,
    };

    setListings((prev) => [listing, ...prev]);
    return listing;
  };

  return (
    <SellerContext.Provider
      value={{
        isVerified,
        identity,
        verifySeller,
        credits: user.credits,
        addCredits,
        selectedPackageId,
        setSelectedPackageId,
        orders,
        listings,
        acceptOrder,
        rejectOrder,
        closeSale,
        publishListing,
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
