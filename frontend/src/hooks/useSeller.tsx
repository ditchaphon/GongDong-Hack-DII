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
import { ListingDraft, ListingStatus, SellerListing } from '@/types';
import { CreditEntry } from '@/types/v4';
import { useLiff } from '@/hooks/useLiff';
import {
  api,
  isLocalPendingImageUrl,
  safeDeleteUploadedImage,
  uploadDeferredImageIfNeeded,
} from '@/lib/api';
import { checklistToConditionAnswers, toUiBookGrade } from '@/lib/catalog';
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

export interface TopUpReceipt {
  packId: string;
  credits: number;
  price: number;
  totalCredits: number;
  verifiedName: string;
  completedAt: string;
}

export interface SellerContextValue {
  shop: ShopSettings | null;
  isShopSetup: boolean;
  loading: boolean;
  hasResolved: boolean;
  loadError: string | null;
  refreshSellerData: () => Promise<void>;
  saveShop: (
    settings: Omit<ShopSettings, 'setupComplete' | 'payeeVerified' | 'kyc'>
  ) => Promise<void>;
  submitKyc: (kyc: ShopKyc & { nationalId?: string; pdpaConsent?: boolean }) => Promise<void>;
  credits: number;
  addCredits: (amount: number) => void;
  ledger: CreditEntry[];
  lastTopUpReceipt: TopUpReceipt | null;
  submitTopUpSlip: (input: {
    packId: string;
    credits: number;
    price: number;
    slipImageUrl: string;
  }) => Promise<TopUpReceipt>;
  selectedPackageId: string;
  setSelectedPackageId: (id: string) => void;
  listings: SellerListing[];
  publishListing: (draft: ListingDraft) => Promise<SellerListing>;
  updateListing: (id: string, patch: Partial<SellerListing>) => Promise<void>;
  setListingStatus: (id: string, status: ListingStatus) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
}

const SellerContext = createContext<SellerContextValue | null>(null);

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';

const SELLER_CACHE_PREFIX = 'gongdong.sellerCache.v1.';

interface SellerCachePayload {
  shop: ShopSettings | null;
  listings: SellerListing[];
  ledger: CreditEntry[];
}

function readSellerCache(userKey: string): SellerCachePayload | null {
  if (!userKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${SELLER_CACHE_PREFIX}${userKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SellerCachePayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      shop: parsed.shop ?? null,
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
    };
  } catch {
    return null;
  }
}

function writeSellerCache(userKey: string, payload: SellerCachePayload): void {
  if (!userKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${SELLER_CACHE_PREFIX}${userKey}`,
      JSON.stringify(payload)
    );
  } catch {
    // ignore storage quota errors
  }
}

function isSellerContextRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/seller') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/orders')
  );
}

export const SellerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const { user, isReady, isLoggedIn, idToken, refreshUser, addCredits } =
    useLiff();

  const userKey = user.id || user.lineUserId || '';
  const loadedTokenRef = useRef<string | null>(null);
  const hydratedCacheKeyRef = useRef<string | null>(null);
  const [shop, setShop] = useState<ShopSettings | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [ledger, setLedger] = useState<CreditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState('bookworm');
  const [lastTopUpReceipt, setLastTopUpReceipt] = useState<TopUpReceipt | null>(null);

  const isShopSetup = !!shop?.setupComplete;

  // Hydrate per-user cached shop immediately while fresh data fetches in background
  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn || !idToken) {
      hydratedCacheKeyRef.current = null;
      loadedTokenRef.current = null;
      setShop(null);
      setListings([]);
      setLedger([]);
      setLoadError(
        isLoggedIn && !idToken
          ? 'เซสชัน LINE หมดอายุ กรุณากดลองใหม่หรือเปิดผ่านเมนูอีกครั้ง'
          : null
      );
      setHasResolved(true);
      return;
    }
    if (!userKey || hydratedCacheKeyRef.current === userKey) return;
    hydratedCacheKeyRef.current = userKey;
    const cached = readSellerCache(userKey);
    if (cached) {
      setShop(cached.shop);
      setListings(cached.listings);
      setLedger(cached.ledger);
      if (cached.shop?.setupComplete) {
        setHasResolved(true);
      }
    }
  }, [isReady, isLoggedIn, idToken, userKey]);

  const refreshSellerData = useCallback(async () => {
    if (!idToken) return;
    loadedTokenRef.current = idToken;
    setLoading(true);
    setLoadError(null);
    try {
      const [shopRes, booksRes, ledgerRes] = await Promise.all([
        api.get<BackendMyShopResponse>('/api/seller/shop', { token: idToken }),
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
      const nextListings = (booksRes.books ?? []).map((b) =>
        mapBackendUserBookToSellerListing(b, nextShop, user)
      );
      const nextLedger = (ledgerRes.items ?? []).map(mapBackendCreditLedgerRow);

      setShop(nextShop);
      setListings(nextListings);
      setLedger(nextLedger);
      setLoadError(null);

      if (userKey) {
        writeSellerCache(userKey, {
          shop: nextShop,
          listings: nextListings,
          ledger: nextLedger,
        });
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลร้านได้'
      );
    } finally {
      setLoading(false);
      setHasResolved(true);
    }
  }, [idToken, userKey, user.id, user.displayName, user.pictureUrl, user.isVerifiedSeller]);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) {
      loadedTokenRef.current = null;
      return;
    }
    if (!isSellerContextRoute(pathname)) return;
    if (loadedTokenRef.current === idToken) return;
    refreshSellerData();
  }, [isReady, isLoggedIn, idToken, pathname, refreshSellerData]);

  const needsSellerContext = isSellerContextRoute(pathname);
  const isHydrating =
    !isReady ||
    (isLoggedIn && Boolean(idToken) && needsSellerContext && !hasResolved && !shop);

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

  const submitKyc = async (kyc: ShopKyc & { nationalId?: string; pdpaConsent?: boolean }) => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ กรุณารอสักครู่');
    }
    if (!kyc.nationalId) {
      throw new Error('กรุณากรอกเลขบัตรประชาชน 13 หลัก');
    }

    await api.post(
      '/api/seller/kyc',
      {
        firstName: kyc.firstName,
        lastName: kyc.lastName,
        nationalId: kyc.nationalId,
        ...(kyc.pdpaConsent ? { pdpaConsent: true } : {}),
      },
      { token: idToken }
    );
    await Promise.all([refreshUser(), refreshSellerData()]);
  };

  const publishListing = async (draft: ListingDraft): Promise<SellerListing> => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    }

    const canParcel = Boolean(shop?.payeeVerified && shop?.supportsParcel);
    const allowedDelivery = canParcel
      ? draft.deliveryMethods
      : draft.deliveryMethods.filter((method) => method === 'MEETUP');
    const finalDelivery = allowedDelivery.length ? allowedDelivery : ['MEETUP'];

    const resolvedCategories = Array.from(
      new Set(
        draft.categories
          .map((category) =>
            category === 'อื่น ๆ'
              ? draft.customCategory.trim() || category
              : category.trim()
          )
          .filter(Boolean)
      )
    );
    const primaryCategory = resolvedCategories[0] || 'อื่น ๆ';
    const rawCoverUrl = draft.photos.cover || FALLBACK_COVER;
    const rawBackUrl = draft.photos.back || rawCoverUrl;
    const rawSpineUrl = draft.photos.spine || rawCoverUrl;
    const rawInnerUrl = draft.photos.inner || draft.photos.nameTag || rawCoverUrl;

    const newlyUploadedUrls: string[] = [];
    const uploadedCache = new Map<string, Promise<string>>();
    const resolveImageUrl = async (rawUrl: string): Promise<string> => {
      if (!rawUrl || !isLocalPendingImageUrl(rawUrl)) return rawUrl;
      let pending = uploadedCache.get(rawUrl);
      if (!pending) {
        pending = uploadDeferredImageIfNeeded(rawUrl, 'book-listings').then((res) => {
          if (res.uploadedNow) newlyUploadedUrls.push(res.url);
          return res.url;
        });
        uploadedCache.set(rawUrl, pending);
      }
      return pending;
    };

    try {
      const [coverUrl, backUrl, spineUrl, innerUrl] = await Promise.all([
        resolveImageUrl(rawCoverUrl),
        resolveImageUrl(rawBackUrl),
        resolveImageUrl(rawSpineUrl),
        resolveImageUrl(rawInnerUrl),
      ]);

      const resolvedDefects = await Promise.all(
        draft.defects.map(async (defect) => ({
          ...defect,
          photo: defect.photo ? await resolveImageUrl(defect.photo) : undefined,
        }))
      );

      const resolvedDefectPhotos = (
        await Promise.all(
          (draft.photos.defects ?? []).filter(Boolean).map((url) => resolveImageUrl(url))
        )
      ).filter(Boolean);

      const resolvedPhotoChecks: typeof draft.photoChecks = draft.photoChecks
        ? Object.fromEntries(
            await Promise.all(
              Object.entries(draft.photoChecks).map(async ([slot, check]) => [
                slot,
                check?.defectPhoto
                  ? { ...check, defectPhoto: await resolveImageUrl(check.defectPhoto) }
                  : check,
              ])
            )
          )
        : {};

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

      resolvedDefectPhotos.forEach((url, index) => {
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
        categories?: string[];
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
          categories: resolvedCategories.length ? resolvedCategories : [primaryCategory],
          description: draft.description.trim() || null,
          isSet: draft.mode === 'SET',
          totalVolumes: draft.mode === 'SET' ? draft.totalVolumes : null,
          missingVolumes: draft.mode === 'SET' ? draft.missingVolumes : [],
          defects: resolvedDefects,
          photoChecks: resolvedPhotoChecks,
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

      return {
        id: created.id,
        title: created.title || draft.title,
        author: draft.author,
        publisher: draft.publisher || undefined,
        description: draft.description || undefined,
        categories: created.categories?.length ? created.categories : resolvedCategories,
        isbn: safeIsbn,
        isSet: draft.mode === 'SET',
        totalVolumes: draft.mode === 'SET' ? draft.totalVolumes : undefined,
        price: Number(created.price ?? draft.price),
        originalPrice: draft.originalPrice || undefined,
        grade: toUiBookGrade(created.grade),
        checklist: draft.checklist,
        photos: {
          cover: coverUrl,
          back: backUrl,
          spine: spineUrl,
          nameTag: innerUrl,
          defects: resolvedDefectPhotos,
        },
        sellerId: user.id,
        sellerName: shop?.shopName || 'ร้านค้ากองดอง',
        sellerRating: 0,
        sellerAvatar: shop?.avatar,
        isPromptPayVerified: shop?.payeeVerified ?? false,
        deliveryMethods: finalDelivery as ListingDraft['deliveryMethods'],
        meetupZones: shop?.meetupPoints.map((p) => p.name) ?? [],
        createdAt: 'เมื่อสักครู่',
        status: 'ACTIVE',
        views: 0,
        savedCount: 0,
        defects: resolvedDefects.map((d) => ({
          label: d.note,
          photo: d.photo || FALLBACK_COVER,
        })),
      };
    } catch (err) {
      if (newlyUploadedUrls.length > 0) {
        await Promise.allSettled(
          newlyUploadedUrls.map((url) => safeDeleteUploadedImage(url))
        );
      }
      throw err;
    }
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

  const deleteListing = async (id: string) => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ กรุณารอสักครู่');
    }
    await api.delete(`/api/books/${encodeURIComponent(id)}`, { token: idToken });
    setListings((prev) => {
      const next = prev.filter((listing) => listing.id !== id);
      if (userKey) {
        writeSellerCache(userKey, { shop, listings: next, ledger });
      }
      return next;
    });
  };

  const submitTopUpSlip = async (input: {
    packId: string;
    credits: number;
    price: number;
    slipImageUrl: string;
  }): Promise<TopUpReceipt> => {
    if (!idToken) {
      throw new Error('ยังไม่ได้เข้าสู่ระบบ กรุณารอสักครู่');
    }

    const res = await api.post<{
      added_credits: number;
      total_credits: number;
      verified_name: string;
      is_verified_seller: boolean;
    }>(
      '/api/users/me/topup-slip',
      {
        slip_image_url: input.slipImageUrl,
        pack_id: input.packId,
        amount: input.price,
      },
      { token: idToken }
    );

    await Promise.all([refreshUser(), refreshSellerData()]);

    const receipt: TopUpReceipt = {
      packId: input.packId,
      credits: res.added_credits ?? input.credits,
      price: input.price,
      totalCredits: res.total_credits,
      verifiedName: res.verified_name,
      completedAt: new Date().toISOString(),
    };
    setLastTopUpReceipt(receipt);
    try {
      window.sessionStorage.setItem('gongdong.last_topup_receipt', JSON.stringify(receipt));
    } catch {
      // Ignore storage errors
    }
    return receipt;
  };

  return (
    <SellerContext.Provider
      value={{
        shop,
        isShopSetup,
        loading: loading || isHydrating,
        hasResolved,
        loadError,
        refreshSellerData,
        saveShop,
        submitKyc,
        credits: user.credits,
        addCredits,
        ledger,
        lastTopUpReceipt,
        submitTopUpSlip,
        selectedPackageId,
        setSelectedPackageId,
        listings,
        publishListing,
        updateListing,
        setListingStatus,
        deleteListing,
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
