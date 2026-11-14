import { describe, expect, it, vi } from 'vitest';
import { createOrderReview, getUserReviews } from '../reviewService';

describe('reviewService', () => {
  describe('createOrderReview', () => {
    const mockCompletedOrder = {
      id: 'ord-1',
      buyerId: 'usr-buyer',
      sellerId: 'usr-seller',
      status: 'COMPLETED',
    };

    it('ผู้ซื้อควรส่งรีวิวร้านค้าสำเร็จพร้อม is_condition_accurate', async () => {
      const mockPrisma = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockCompletedOrder),
        },
        review: {
          findFirst: vi.fn().mockResolvedValue(null), // ยังไม่เคยรีวิว
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'rev-1', ...data, createdAt: new Date() })
          ),
        },
      };

      const result = await createOrderReview(
        'ord-1',
        'usr-buyer',
        {
          rating: 5,
          is_condition_accurate: true,
          comment: 'หนังสือสภาพดีมาก ห่อกันกระแทกอย่างดี',
        },
        mockPrisma
      );

      expect(result.rating).toBe(5);
      expect(result.isConditionAccurate).toBe(true);
      expect(result.reviewerId).toBe('usr-buyer');
      expect(result.revieweeId).toBe('usr-seller');
      expect(mockPrisma.review.create).toHaveBeenCalledWith({
        data: {
          orderId: 'ord-1',
          reviewerId: 'usr-buyer',
          revieweeId: 'usr-seller',
          rating: 5,
          isConditionAccurate: true,
          tags: [],
          comment: 'หนังสือสภาพดีมาก ห่อกันกระแทกอย่างดี',
        },
      });
    });

    it('ผู้ขายควรส่งรีวิวผู้ซื้อสำเร็จ (isConditionAccurate เป็น null)', async () => {
      const mockPrisma = {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockCompletedOrder),
        },
        review: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) =>
            Promise.resolve({ id: 'rev-2', ...data, createdAt: new Date() })
          ),
        },
      };

      const result = await createOrderReview(
        'ord-1',
        'usr-seller',
        {
          rating: 5,
          comment: 'ผู้ซื้อสุภาพ ตรงต่อเวลามากครับ',
        },
        mockPrisma
      );

      expect(result.rating).toBe(5);
      expect(result.isConditionAccurate).toBeNull();
      expect(result.reviewerId).toBe('usr-seller');
      expect(result.revieweeId).toBe('usr-buyer');
    });

    it('ควรโยน Error 404 ORDER_NOT_FOUND หากไม่พบออเดอร์', async () => {
      const mockPrisma = {
        order: { findUnique: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        createOrderReview('ord-not-found', 'usr-buyer', { rating: 5 }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    });

    it('ควรโยน Error 400 INVALID_ORDER_STATUS หากออเดอร์ยังไม่เสร็จสิ้น (ยังไม่ใช่ COMPLETED)', async () => {
      const mockPrisma = {
        order: {
          findUnique: vi.fn().mockResolvedValue({
            ...mockCompletedOrder,
            status: 'SHIPPED',
          }),
        },
      };

      await expect(
        createOrderReview('ord-1', 'usr-buyer', { rating: 5, is_condition_accurate: true }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_ORDER_STATUS',
      });
    });

    it('ควรโยน Error 403 FORBIDDEN หากคนส่งรีวิวไม่ใช่ทั้งผู้ซื้อและผู้ขายของออเดอร์', async () => {
      const mockPrisma = {
        order: { findUnique: vi.fn().mockResolvedValue(mockCompletedOrder) },
      };

      await expect(
        createOrderReview('ord-1', 'usr-stranger', { rating: 5 }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('ควรโยน Error 400 ALREADY_REVIEWED หากเคยส่งรีวิวสำหรับออเดอร์นี้ไปแล้ว (One-time write)', async () => {
      const mockPrisma = {
        order: { findUnique: vi.fn().mockResolvedValue(mockCompletedOrder) },
        review: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing-rev' }),
        },
      };

      await expect(
        createOrderReview(
          'ord-1',
          'usr-buyer',
          { rating: 5, is_condition_accurate: true },
          mockPrisma
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'ALREADY_REVIEWED',
      });
    });

    it('ควรโยน Error 400 INVALID_RATING หากคะแนนไม่ได้อยู่ระหว่าง 1 ถึง 5', async () => {
      const mockPrisma = {
        order: { findUnique: vi.fn().mockResolvedValue(mockCompletedOrder) },
        review: { findFirst: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        createOrderReview('ord-1', 'usr-buyer', { rating: 6, is_condition_accurate: true }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_RATING',
      });

      await expect(
        createOrderReview('ord-1', 'usr-buyer', { rating: 0, is_condition_accurate: true }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_RATING',
      });
    });

    it('ควรโยน Error 400 CONDITION_ACCURACY_REQUIRED หากผู้ซื้อไม่ส่ง is_condition_accurate', async () => {
      const mockPrisma = {
        order: { findUnique: vi.fn().mockResolvedValue(mockCompletedOrder) },
        review: { findFirst: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        createOrderReview('ord-1', 'usr-buyer', { rating: 5 }, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: 'CONDITION_ACCURACY_REQUIRED',
      });
    });
  });

  describe('getUserReviews', () => {
    it('ควรคำนวณคะแนนเฉลี่ย, สภาพตรงเกรด, และการกระจายดาวถูกต้อง', async () => {
      const mockUser = { id: 'usr-seller-1', displayName: 'Book Cafe' };

      const mockReviews = [
        {
          id: 'rev-1',
          orderId: 'ord-101',
          rating: 5,
          isConditionAccurate: true,
          comment: 'เยี่ยมมาก',
          createdAt: new Date('2026-11-12T10:00:00Z'),
          reviewer: { id: 'b1', nickname: 'หมอก', avatarUrl: 'https://ex.com/a1.webp' },
          order: {
            orderItems: [
              {
                bookListing: {
                  bookCatalog: { title: 'Clean Code' },
                },
              },
            ],
          },
        },
        {
          id: 'rev-2',
          orderId: 'ord-102',
          rating: 4,
          isConditionAccurate: true,
          comment: 'ดีครับ',
          createdAt: new Date('2026-11-12T09:00:00Z'),
          reviewer: { id: 'b2', nickname: 'เต้', avatarUrl: null },
          order: {
            orderItems: [
              {
                bookListing: {
                  bookCatalog: { title: 'Refactoring' },
                },
              },
            ],
          },
        },
        {
          id: 'rev-3',
          orderId: 'ord-103',
          rating: 3,
          isConditionAccurate: false, // สภาพไม่ตรงเกรด
          comment: 'มีรอยพับที่ไม่ได้แจ้ง',
          createdAt: new Date('2026-11-12T08:00:00Z'),
          reviewer: { id: 'b3', nickname: 'อาร์ม', avatarUrl: null },
          order: {
            orderItems: [],
          },
        },
      ];

      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
        review: { findMany: vi.fn().mockResolvedValue(mockReviews) },
      };

      const result = await getUserReviews('usr-seller-1', { limit: 10, offset: 0 }, mockPrisma);

      // (5 + 4 + 3) / 3 = 4.0
      expect(result.summary.average_rating).toBe(4.0);
      expect(result.summary.total_reviews).toBe(3);
      // ตรงเกรด 2 จาก 3 = 66.7%
      expect(result.summary.condition_accuracy_rate).toBe(66.7);
      expect(result.summary.rating_breakdown).toEqual({
        1: 0,
        2: 0,
        3: 1,
        4: 1,
        5: 1,
      });

      expect(result.reviews.length).toBe(3);
      expect(result.reviews[0].book_titles).toEqual(['Clean Code']);
      expect(result.reviews[1].book_titles).toEqual(['Refactoring']);
      expect(result.reviews[2].book_titles).toEqual([]);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.has_more).toBe(false);
    });

    it('ควรคืนค่าเริ่มต้นที่เหมาะสมเมื่อผู้ขายยังไม่มีรีวิว', async () => {
      const mockUser = { id: 'usr-new-seller' };
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(mockUser) },
        review: { findMany: vi.fn().mockResolvedValue([]) },
      };

      const result = await getUserReviews('usr-new-seller', undefined, mockPrisma);

      expect(result.summary.average_rating).toBe(0);
      expect(result.summary.total_reviews).toBe(0);
      expect(result.summary.condition_accuracy_rate).toBeNull();
      expect(result.summary.rating_breakdown).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
      expect(result.reviews).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.has_more).toBe(false);
    });

    it('ควรโยน Error 404 USER_NOT_FOUND หากไม่พบผู้ใช้', async () => {
      const mockPrisma = {
        user: { findUnique: vi.fn().mockResolvedValue(null) },
      };

      await expect(
        getUserReviews('usr-not-exist', undefined, mockPrisma)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'USER_NOT_FOUND',
      });
    });
  });
});
