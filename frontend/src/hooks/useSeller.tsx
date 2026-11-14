'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { ListingDraft, ListingStatus, SellerListing } from '@/types';
import { CreditEntry } from '@/types/v4';
import { useLiff } from '@/hooks/useLiff';
import { api } from '@/lib/api';
import { checklistToConditionAnswers } from '@/lib/catalog';
import {
  BackendCreditLedgerRow,
  BackendMyShopResponse,
  BackendUserBookItem,
  mapBackendCreditLedgerRow,
  mapBackendShopToShopSettings,
  mapBackendUserBookToSellerListing,
} from '@/lib/mappers';
import type { MeetupPoint, ShipMode } from '@/lib/delivery';

/** KYC result kept for the prototype: masked values only, never the raw ID. */
export interface ShopKyc {
  firstName: string;
  lastName: string;
  nationalIdMasked: string;
  verifiedAt: string;
}

/** Public shop identity + delivery settings. KYC is admin-only data. */
export interface ShopSettings {
  shopName: string;
  description: string;
  avatar?: string;
  /** Province parcels ship from (used for the calculated fee). */
  province: string;
  /** Seller-defined meet-up points, any province. */
  meetupPoints: MeetupPoint[];
  /** Days the seller can meet or ship, e.g. ['จ', 'พ']. */
  availableDays: string[];
  availableSlots: string[];
  supportsParcel: boolean;
  /** Ship every day, or within N days after the order is paid. */
  shipMode: ShipMode;
  shipWithinDays: number;
  /** Payout verification is admin-only data; buyers only see a badge. */
  payeeVerified: boolean;
  kyc?: ShopKyc;
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
  loading: boolean;
  refreshSellerData: () => Promise<void>;
  saveShop: (
    settings: Omit<ShopSettings, 'setupComplete' | 'payeeVerified' | 'kyc'>
  ) => Promise<void>;
  submitKyc: (kyc: ShopKyc & { nationalId?: string }) => Promise<void>;
  verifyPayee: () => void;
  credits: number;
  addCredits: (amount: number) => void;
  ledger: CreditEntry[];
  pendingTopUp: PendingTopUp | null;
  submitTopUp: (pack: { id: string; credits: number; price: number }) => void;
  approveTopUp: () => void;
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  listings: SellerListing[];
  publishListing: (draft: ListingDraft) => Promise<SellerListing>;
  updateListing: (id: string, patch: Partial<SellerListing>) => Promise<void>;
  setListingStatus: (id: string, status: ListingStatus) => Promise<void>;
}

const SellerContext = createContext<SellerContextValue | null>(null);

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';

export const SellerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user, isReady, isLoggedIn, idToken, refreshUser, addCredits } =
    useLiff();

  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [ledger, setLedger] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('bookworm');
  const [pendingTopUp, setPendingTopUp] = useState<PendingTopUp | null>(null);

  const isShopSetup = !!shop?.setupComplete;

  const refreshSellerData = useCallback(async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const [shopRes, booksRes, ledgerRes] = await Promise.all([
        api
          .get<BackendMyShopResponse>('/api/seller/shop', { token: idToken })
          .catch(() => null),
        api
          .get<{ books: BackendUserBookItem[] }>('/api/users/me/books', {
            token: idToken,
          })
          .catch(() => ({ books: [] })),
        api
          .get<{ items: BackendCreditLedgerRow[] }>('/api/users/me/credits/history', {
            token: idToken,
          })
          .catch(() => ({ items: [] })),
      ]);

      const nextShop = shopRes ? mapBackendShopToShopSettings(shopRes) : null;
      setShop(nextShop);
      setListings(
        (booksRes.books ?? []).map((b) =>
          mapBackendUserBookToSellerListing(b, nextShop, user)
        )
      );
      setLedger((ledgerRes.items ?? []).map(mapBackendCreditLedgerRow));
    } finally {
      setLoading(false);
    }
  }, [idToken, user.id, user.displayName, user.pictureUrl, user.isVerifiedSeller]);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) return;
    refreshSellerData();
  }, [isReady, isLoggedIn, idToken, refreshSellerData]);

  const saveShop = async (
    settings: Omit<ShopSettings, 'setupComplete' | 'payeeVerified' | 'kyc'>
  ) => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ กรุณารอสักครู่');
    }

    await api.put(
      '/api/seller/shop',
      {
        shopName: settings.shopName,
        description: settings.description,
        avatarUrl: settings.avatar,
        province: settings.province,
        availableDays: settings.availableDays,
        availableSlots: settings.availableSlots,
        supportsParcel: settings.supportsParcel,
        shipMode: settings.shipMode,
        shipWithinDays: settings.shipWithinDays,
      },
      { token: idToken }
    );

    // Sync meetup points diff with backend
    const existingPoints = shop?.meetupPoints ?? [];
    const desiredIds = new Set(settings.meetupPoints.map((p) => p.id));
    const existingIds = new Set(existingPoints.map((p) => p.id));

    for (const oldPoint of existingPoints) {
      if (!desiredIds.has(oldPoint.id)) {
        await api
          .delete(`/api/seller/meetup-points/${oldPoint.id}`, { token: idToken })
          .catch(() => undefined);
      }
    }

    for (const point of settings.meetupPoints) {
      if (!existingIds.has(point.id)) {
        await api.post(
          '/api/seller/meetup-points',
          {
            name: point.name,
            province: point.province,
            lat: point.lat,
            lng: point.lng,
            note: point.note,
          },
          { token: idToken }
        );
      }
    }

    await refreshSellerData();
  };

  const submitKyc = async (kyc: ShopKyc & { nationalId?: string }) => {
    if (idToken && kyc.nationalId) {
      await api.post(
        '/api/seller/kyc',
        {
          firstName: kyc.firstName,
          lastName: kyc.lastName,
          nationalId: kyc.nationalId,
        },
        { token: idToken }
      );
      await refreshUser();
      await refreshSellerData();
      return;
    }

    setShop((prev) =>
      prev
        ? {
            ...prev,
            kyc: {
              firstName: kyc.firstName,
              lastName: kyc.lastName,
              nationalIdMasked: kyc.nationalIdMasked,
              verifiedAt: kyc.verifiedAt,
            },
            payeeVerified: true,
          }
        : prev
    );
  };

  const verifyPayee = () => {
    setShop((prev) => (prev ? { ...prev, payeeVerified: true } : prev));
  };

  const publishListing = async (draft: ListingDraft): Promise<SellerListing> => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    }

    const allowedDelivery = shop?.payeeVerified
      ? draft.deliveryMethods
      : draft.deliveryMethods.filter((method) => method === 'MEETUP');
    const finalDelivery = allowedDelivery.length ? allowedDelivery : ['MEETUP'];

    const primaryCategory = draft.categories[0] || 'อื่น ๆ';
    const coverUrl = draft.photos.cover || FALLBACK_COVER;
    const backUrl = draft.photos.back || coverUrl;
    const spineUrl = draft.photos.spine || coverUrl;
    const innerUrl = draft.photos.inner || draft.photos.nameTag || coverUrl;

    const images: Array<{
      imageUrl: string;
      imageType: 'FRONT_COVER' | 'BACK_COVER' | 'SPINE' | 'INNER' | 'DEFECT';
      displayOrder: number;
      isCover?: boolean;
    }> = [
      { imageUrl: coverUrl, imageType: 'FRONT_COVER', displayOrder: 1, isCover: true },
      { imageUrl: backUrl, imageType: 'BACK_COVER', displayOrder: 2 },
      { imageUrl: spineUrl, imageType: 'SPINE', displayOrder: 3 },
      { imageUrl: innerUrl, imageType: 'INNER', displayOrder: 4 },
    ];

    (draft.photos.defects ?? []).forEach((url, index) => {
      if (url) {
        images.push({
          imageUrl: url,
          imageType: 'DEFECT',
          displayOrder: 5 + index,
        });
      }
    });

    const cleanIsbn = draft.isbn.replace(/[-\s]/g, '').trim();
    const safeIsbn = /^(?:\d{9}[\dX]|\d{13})$/i.test(cleanIsbn)
      ? cleanIsbn
      : `299${String(Date.now()).slice(-10)}`;

    const firstMeetup = shop?.meetupPoints[0];

    const created = await api.post<{
      id: string;
      title: string;
      price: number;
      grade: string;
    }>(
      '/api/books',
      {
        isbn: safeIsbn,
        title: draft.title.trim(),
        author: draft.author.trim() || null,
        publisher: draft.publisher.trim() || null,
        category: primaryCategory,
        categories: draft.categories.length ? draft.categories : [primaryCategory],
        description: draft.description.trim() || null,
        isSet: draft.mode === 'SET',
        totalVolumes: draft.mode === 'SET' ? draft.totalVolumes : null,
        missingVolumes: draft.mode === 'SET' ? draft.missingVolumes : [],
        defects: draft.defects,
        photoChecks: draft.photoChecks ?? {},
        coverUrl,
        originalPrice: draft.originalPrice > 0 ? draft.originalPrice : null,
        price: draft.price,
        conditionAnswers: checklistToConditionAnswers(draft.checklist),
        allowPickup: finalDelivery.includes('MEETUP'),
        pickupLat: firstMeetup?.lat ?? null,
        pickupLng: firstMeetup?.lng ?? null,
        pickupLocationName: firstMeetup?.name ?? null,
        allowDelivery: finalDelivery.includes('PARCEL'),
        codEnabled: true,
        images,
      },
      { token: idToken }
    );

    await refreshSellerData();

    const matched = listings.find((l) => l.id === created.id);
    if (matched) return matched;

    return {
      id: created.id,
      title: draft.title,
      author: draft.author,
      publisher: draft.publisher || undefined,
      description: draft.description || undefined,
      categories: draft.categories,
      isbn: safeIsbn,
      isSet: draft.mode === 'SET',
      totalVolumes: draft.mode === 'SET' ? draft.totalVolumes : undefined,
      price: draft.price,
      originalPrice: draft.originalPrice || undefined,
      grade: 'B',
      checklist: draft.checklist,
      photos: {
        cover: coverUrl,
        back: backUrl,
        spine: spineUrl,
        nameTag: innerUrl,
        defects: draft.photos.defects,
      },
      sellerId: user.id,
      sellerName: shop?.shopName || user.displayName,
      sellerRating: 5.0,
      sellerAvatar: shop?.avatar || user.pictureUrl,
      isPromptPayVerified: shop?.payeeVerified ?? false,
      deliveryMethods: finalDelivery as ListingDraft['deliveryMethods'],
      meetupZones: shop?.meetupPoints.map((p) => p.name) ?? [],
      createdAt: 'เมื่อสักครู่',
      status: 'ACTIVE',
      views: 0,
      savedCount: 0,
    };
  };

  const updateListing = async (id: string, patch: Partial<SellerListing>) => {
    if (idToken) {
      await api.patch(
        `/api/books/${id}`,
        {
          ...(patch.price !== undefined ? { price: patch.price } : {}),
          ...(patch.description !== undefined
            ? { description: patch.description }
            : {}),
          ...(patch.categories !== undefined
            ? { categories: patch.categories }
            : {}),
          ...(patch.deliveryMethods !== undefined
            ? {
                allowPickup: patch.deliveryMethods.includes('MEETUP'),
                allowDelivery: patch.deliveryMethods.includes('PARCEL'),
              }
            : {}),
          ...(patch.status !== undefined
            ? { status: patch.status === 'HIDDEN' ? 'HIDDEN' : 'AVAILABLE' }
            : {}),
        },
        { token: idToken }
      );
    }

    setListings((prev) =>
      prev.map((listing) =>
        listing.id === id ? { ...listing, ...patch } : listing
      )
    );
  };

  const setListingStatus = async (id: string, status: ListingStatus) => {
    await updateListing(id, { status });
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
        loading,
        refreshSellerData,
        saveShop,
        submitKyc,
        verifyPayee,
        credits: user.credits,
        addCredits,
        ledger,
        pendingTopUp,
        submitTopUp,
        approveTopUp,
        selectedPackageId,
        setSelectedPackageId,
        listings,
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
