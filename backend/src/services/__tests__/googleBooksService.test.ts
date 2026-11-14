import { describe, it, expect, vi } from 'vitest';
import { getBookByIsbn, sanitizeIsbn } from '../googleBooksService';

describe('GoogleBooksService - ISBN Lookup & Cache-Aside', () => {
  describe('sanitizeIsbn', () => {
    it('ควรตัดขีดและช่องว่างออกจาก ISBN-13 ได้อย่างถูกต้อง', () => {
      expect(sanitizeIsbn('978-616-18-4567-8')).toBe('9786161845678');
      expect(sanitizeIsbn('978 616 18 4567 8')).toBe('9786161845678');
    });

    it('ควรตัดขีดและช่องว่างออกจาก ISBN-10 (รวมตัวลงท้าย X) ได้อย่างถูกต้อง', () => {
      expect(sanitizeIsbn('0-13-235088-2')).toBe('0132350882');
      expect(sanitizeIsbn('1-56619-909-x')).toBe('156619909X');
    });

    it('ควรโยน AppError (400 INVALID_ISBN) เมื่อ ISBN มีความยาวหรือไม่ตรงตามรูปแบบ', () => {
      expect(() => sanitizeIsbn('12345')).toThrowError(
        expect.objectContaining({ statusCode: 400, code: 'INVALID_ISBN' })
      );
      expect(() => sanitizeIsbn('978-616-INVALID')).toThrowError(
        expect.objectContaining({ statusCode: 400, code: 'INVALID_ISBN' })
      );
    });
  });

  describe('getBookByIsbn (Cache-Aside & Mocked Fetch)', () => {
    it('กรณี Cache Hit: พบในฐานข้อมูล ต้องส่งคืนข้อมูลทันทีโดยไม่ยิง Google Books API เลย (0 Request)', async () => {
      const mockCachedRecord = {
        isbn: '9786161845678',
        title: 'จิตวิทยาวาทะด้วยเงิน',
        author: 'Morgan Housel',
        publisher: 'Live Rich',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        coverUrl: 'https://storage.gongdong.com/covers/9786161845678.webp',
        originalPrice: 290,
      };

      const mockDb = {
        bookCatalog: {
          findUnique: vi.fn().mockResolvedValue(mockCachedRecord),
          upsert: vi.fn(),
        },
      };

      const mockFetch = vi.fn();

      const result = await getBookByIsbn('978-616-18-4567-8', {
        prismaClient: mockDb,
        fetcher: mockFetch,
      });

      // ยืนยันว่าอ่านจาก Cache
      expect(mockDb.bookCatalog.findUnique).toHaveBeenCalledWith({
        where: { isbn: '9786161845678' },
      });
      // ยืนยันว่าไม่ยิง Google Books API เลยแม้แต่ครั้งเดียว เพื่อประหยัดโควต้า
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockDb.bookCatalog.upsert).not.toHaveBeenCalled();

      expect(result).toEqual({
        isbn: '9786161845678',
        title: 'จิตวิทยาวาทะด้วยเงิน',
        author: 'Morgan Housel',
        publisher: 'Live Rich',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        coverUrl: 'https://storage.gongdong.com/covers/9786161845678.webp',
        originalPrice: 290,
      });
    });

    it('กรณี Cache Miss: ไม่พบใน DB ให้ยิง API โดยระบุ &maxResults=1 (1 เล่มเท่านั้น) และแคชลง DB', async () => {
      const mockDb = {
        bookCatalog: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
      };

      // Mock Response จาก Google Books เพียง 1 เล่ม (maxResults=1)
      const mockGoogleApiResponse = {
        totalItems: 1,
        items: [
          {
            id: 'mock_vol_1',
            volumeInfo: {
              title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
              authors: ['Robert C. Martin'],
              publisher: 'Prentice Hall',
              categories: ['Computers / Software Development'],
              imageLinks: {
                thumbnail: 'http://books.google.com/books/content?id=clean_code&printsec=frontcover',
              },
            },
            saleInfo: {
              listPrice: {
                amount: 1450,
                currencyCode: 'THB',
              },
            },
          },
        ],
      };

      let requestedUrl = '';
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => mockGoogleApiResponse,
        };
      });

      const result = await getBookByIsbn('9780132350884', {
        prismaClient: mockDb,
        fetcher: mockFetch,
      });

      // ตรวจสอบว่า URL ส่ง &maxResults=1 เพื่อประหยัด Token และ Bandwidth ตามที่ตกลงไว้
      expect(requestedUrl).toContain('https://www.googleapis.com/books/v1/volumes?q=isbn:9780132350884&maxResults=1');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // ตรวจสอบการแปลง HTTP เป็น HTTPS ใน URL รูปภาพ
      expect(result?.coverUrl).toBe('https://books.google.com/books/content?id=clean_code&printsec=frontcover');
      expect(result?.author).toBe('Robert C. Martin');
      expect(result?.category).toBe('Computers / Software Development');
      expect(result?.originalPrice).toBe(1450);

      // ตรวจสอบว่ามีการบันทึกแคชลงตาราง book_catalog
      expect(mockDb.bookCatalog.upsert).toHaveBeenCalledWith({
        where: { isbn: '9780132350884' },
        update: expect.objectContaining({
          title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
          author: 'Robert C. Martin',
        }),
        create: expect.objectContaining({
          isbn: '9780132350884',
          title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        }),
      });
    });

    it('กรณีค้นหาไม่พบบน Google Books (totalItems: 0) ต้องส่งคืน null', async () => {
      const mockDb = {
        bookCatalog: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn(),
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ totalItems: 0 }),
      });

      const result = await getBookByIsbn('9789999999999', {
        prismaClient: mockDb,
        fetcher: mockFetch,
      });

      expect(result).toBeNull();
      expect(mockDb.bookCatalog.upsert).not.toHaveBeenCalled();
    });

    it('กรณี Google Books API ล่มหรือตอบกลับสถานะ Error ต้องโยนข้อผิดพลาด', async () => {
      const mockDb = {
        bookCatalog: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      await expect(
        getBookByIsbn('9780132350884', {
          prismaClient: mockDb,
          fetcher: mockFetch,
        })
      ).rejects.toThrow('Google Books API ตอบกลับด้วยสถานะ HTTP 503');
    });
  });
});
