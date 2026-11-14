'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Book, DeliveryMethod, Address } from '@/types';
import { api } from '@/lib/api';
import { calcParcelFee } from '@/lib/delivery';
import { BackendAddress, mapBackendAddressToAddress } from '@/lib/mappers';
import { useLiff } from '@/hooks/useLiff';

const CART_STORAGE_KEY = 'gongdong.cart.v1';

interface PersistedCart {
  items: Book[];
  deliveryMethod: DeliveryMethod;
  meetupZone: string;
  meetupTime: string;
  meetupNote: string;
}

export interface CartContextValue {
  items: Book[];
  sellerId: string | null;
  sellerName: string | null;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  meetupZone: string;
  setMeetupZone: (zone: string) => void;
  meetupTime: string;
  setMeetupTime: (time: string) => void;
  meetupNote: string;
  setMeetupNote: (note: string) => void;
  addresses: Address[];
  addressesLoading: boolean;
  selectedAddress: Address | null;
  setSelectedAddress: (addr: Address | null) => void;
  refreshAddresses: () => Promise<Address[]>;
  addToCart: (book: Book) => {
    success: boolean;
    message?: string;
    reason?: 'OTHER_SHOP' | 'DUPLICATE';
  };
  /** Empty the cart and start over with this book (cart holds one shop). */
  replaceCart: (book: Book) => void;
  removeFromCart: (bookId: string) => void;
  clearCart: () => void;
  bookTotal: number;
  shippingFee: number;
  grandTotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isReady, isLoggedIn, idToken } = useLiff();

  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<Book[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('MEETUP');
  const [meetupZone, setMeetupZone] = useState<string>('');
  const [meetupTime, setMeetupTime] = useState<string>('');
  const [meetupNote, setMeetupNote] = useState<string>('');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedCart>;
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (parsed.deliveryMethod === 'MEETUP' || parsed.deliveryMethod === 'PARCEL') {
          setDeliveryMethod(parsed.deliveryMethod);
        }
        if (typeof parsed.meetupZone === 'string') setMeetupZone(parsed.meetupZone);
        if (typeof parsed.meetupTime === 'string') setMeetupTime(parsed.meetupTime);
        if (typeof parsed.meetupNote === 'string') setMeetupNote(parsed.meetupNote);
      }
    } catch {
      /* ignore corrupted storage */
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedCart = {
        items,
        deliveryMethod,
        meetupZone,
        meetupTime,
        meetupNote,
      };
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore storage errors */
    }
  }, [hydrated, items, deliveryMethod, meetupZone, meetupTime, meetupNote]);

  const refreshAddresses = useCallback(async (): Promise<Address[]> => {
    if (!idToken) return [];
    setAddressesLoading(true);
    try {
      const raw = await api.get<BackendAddress[]>('/api/users/me/addresses', {
        token: idToken,
      });
      const mapped = (Array.isArray(raw) ? raw : []).map(mapBackendAddressToAddress);
      setAddresses(mapped);
      setSelectedAddress((prev) => {
        if (prev && mapped.some((a) => a.id === prev.id)) {
          return mapped.find((a) => a.id === prev.id) ?? prev;
        }
        return mapped.find((a) => a.isDefault) ?? mapped[0] ?? null;
      });
      return mapped;
    } catch (err) {
      console.warn('[useCart] Failed to load addresses:', err);
      return [];
    } finally {
      setAddressesLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (!isReady || !isLoggedIn || !idToken) return;
    refreshAddresses();
  }, [isReady, isLoggedIn, idToken, refreshAddresses]);

  const sellerId = items.length > 0 ? items[0].sellerId : null;
  const sellerName = items.length > 0 ? items[0].sellerName : null;

  const addToCart = (book: Book) => {
    if (items.length > 0 && items[0].sellerId !== book.sellerId) {
      return {
        success: false,
        reason: 'OTHER_SHOP' as const,
        message: `ตะกร้ามีหนังสือจาก "${items[0].sellerName}" อยู่ · สั่งรวมได้ทีละร้าน`,
      };
    }
    if (items.some((i) => i.id === book.id)) {
      return {
        success: false,
        reason: 'DUPLICATE' as const,
        message: 'หนังสือเล่มนี้อยู่ในตะกร้าแล้ว',
      };
    }
    setItems((prev) => [...prev, book]);
    return { success: true };
  };

  const replaceCart = (book: Book) => setItems([book]);

  const removeFromCart = (bookId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== bookId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const bookTotal = items.reduce((sum, item) => sum + item.price, 0);

  const shippingFee =
    deliveryMethod === 'MEETUP'
      ? 0
      : calcParcelFee(items.length, undefined, selectedAddress?.province);

  const grandTotal = bookTotal + shippingFee;

  return (
    <CartContext.Provider
      value={{
        items,
        sellerId,
        sellerName,
        deliveryMethod,
        setDeliveryMethod,
        meetupZone,
        setMeetupZone,
        meetupTime,
        setMeetupTime,
        meetupNote,
        setMeetupNote,
        addresses,
        addressesLoading,
        selectedAddress,
        setSelectedAddress,
        refreshAddresses,
        addToCart,
        replaceCart,
        removeFromCart,
        clearCart,
        bookTotal,
        shippingFee,
        grandTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a <CartProvider>');
  return ctx;
}
