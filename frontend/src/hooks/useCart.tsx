'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { Book, Address } from '@/types';
import { api } from '@/lib/api';
import { BackendAddress, mapBackendAddressToAddress } from '@/lib/mappers';
import { useLiff } from '@/hooks/useLiff';

const CART_STORAGE_PREFIX = 'gongdong.cart.v2';

export interface CartShopGroup {
  sellerId: string;
  sellerName: string;
  items: Book[];
}

interface PersistedCart {
  items: Book[];
}

export interface CartContextValue {
  items: Book[];
  shopGroups: CartShopGroup[];
  addresses: Address[];
  addressesLoading: boolean;
  selectedAddress: Address | null;
  setSelectedAddress: (addr: Address | null) => void;
  refreshAddresses: () => Promise<Address[]>;
  addToCart: (book: Book) => {
    success: boolean;
    message?: string;
    reason?: 'DUPLICATE';
  };
  removeFromCart: (bookId: string) => void;
  removeSellerItems: (sellerId: string) => void;
  removeManyFromCart: (bookIds: string[]) => void;
  syncCartBooks: (freshById: Record<string, Book>) => void;
  clearCart: () => void;
  bookTotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isReady, isLoggedIn, idToken, user } = useLiff();

  const storageKey = user?.id
    ? `${CART_STORAGE_PREFIX}.${user.id}`
    : `${CART_STORAGE_PREFIX}.guest`;
  const loadedKeyRef = useRef<string | null>(null);
  const [items, setItems] = useState<Book[]>([]);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedCart>;
        setItems(Array.isArray(parsed.items) ? parsed.items : []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      loadedKeyRef.current = storageKey;
    }
  }, [storageKey]);

  useEffect(() => {
    if (loadedKeyRef.current !== storageKey) return;
    try {
      const payload: PersistedCart = { items };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      /* ignore storage errors */
    }
  }, [storageKey, items]);

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
    if (!isReady) return;
    if (!isLoggedIn || !idToken) {
      setAddresses([]);
      setSelectedAddress(null);
      return;
    }
    refreshAddresses();
  }, [isReady, isLoggedIn, idToken, refreshAddresses]);

  const shopGroups = useMemo<CartShopGroup[]>(() => {
    const map = new Map<string, CartShopGroup>();
    for (const item of items) {
      const existing = map.get(item.sellerId);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.sellerId, {
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          items: [item],
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const addToCart = useCallback(
    (book: Book) => {
      if (items.some((i) => i.id === book.id)) {
        return {
          success: false,
          reason: 'DUPLICATE' as const,
          message: 'หนังสือเล่มนี้อยู่ในตะกร้าแล้ว',
        };
      }
      setItems((prev) => (prev.some((i) => i.id === book.id) ? prev : [...prev, book]));
      return { success: true };
    },
    [items]
  );

  const removeFromCart = useCallback((bookId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== bookId));
  }, []);

  const removeSellerItems = useCallback((sellerId: string) => {
    setItems((prev) => prev.filter((i) => i.sellerId !== sellerId));
  }, []);

  const removeManyFromCart = useCallback((bookIds: string[]) => {
    const removeSet = new Set(bookIds);
    setItems((prev) => prev.filter((i) => !removeSet.has(i.id)));
  }, []);

  const syncCartBooks = useCallback((freshById: Record<string, Book>) => {
    setItems((prev) =>
      prev.map((item) => {
        const fresh = freshById[item.id];
        return fresh ? { ...item, ...fresh } : item;
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const bookTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        shopGroups,
        addresses,
        addressesLoading,
        selectedAddress,
        setSelectedAddress,
        refreshAddresses,
        addToCart,
        removeFromCart,
        removeSellerItems,
        removeManyFromCart,
        syncCartBooks,
        clearCart,
        bookTotal,
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
