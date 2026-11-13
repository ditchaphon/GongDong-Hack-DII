'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book, DeliveryMethod, Address } from '@/types';
import { MOCK_BOOKS, MOCK_ADDRESSES } from '@/mocks/books';

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
  selectedAddress: Address;
  setSelectedAddress: (addr: Address) => void;
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
  // Initialize with 1 book from seller-01 for demo convenience
  const [items, setItems] = useState<Book[]>([MOCK_BOOKS[0]]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('MEETUP');
  const [meetupZone, setMeetupZone] = useState<string>('หน้าหอสมุดกลาง มช.');
  const [meetupTime, setMeetupTime] = useState<string>('วันศุกร์ 13 พ.ย. 16:30 น.');
  const [meetupNote, setMeetupNote] = useState<string>('');
  const [selectedAddress, setSelectedAddress] = useState<Address>(MOCK_ADDRESSES[0]);

  const sellerId = items.length > 0 ? items[0].sellerId : null;
  const sellerName = items.length > 0 ? items[0].sellerName : null;

  const addToCart = (book: Book) => {
    // If cart has items from another seller, reject with explanation
    if (items.length > 0 && items[0].sellerId !== book.sellerId) {
      return {
        success: false,
        reason: 'OTHER_SHOP' as const,
        message: `ตะกร้ามีหนังสือจาก "${items[0].sellerName}" อยู่ · สั่งรวมได้ทีละร้าน`,
      };
    }
    // Check if already in cart
    if (items.some((i) => i.id === book.id)) {
      return { success: false, reason: 'DUPLICATE' as const, message: 'หนังสือเล่มนี้อยู่ในตะกร้าแล้ว' };
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

  // Pricing calculations
  const bookTotal = items.reduce((sum, item) => sum + item.price, 0);

  // Shipping fee rule: ฿0 for meetup; ฿40 first book + ฿10 each subsequent
  const shippingFee =
    deliveryMethod === 'MEETUP'
      ? 0
      : items.length === 0
      ? 0
      : 40 + (items.length - 1) * 10;

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
        selectedAddress,
        setSelectedAddress,
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

