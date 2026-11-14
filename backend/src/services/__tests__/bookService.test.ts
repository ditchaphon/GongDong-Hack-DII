import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBookListing,
  deleteBookListing,
  getBookListingDetail,
  getBookListings,
  getUserBookListings,
  updateBookListing,
} from '../bookService';
import { CreateBookListingInput } from '../../types';

describe('BookService - Marketplace & Listings Management', () => {
  let mockDb: any;
  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      bookCatalog: {
        upsert: vi.fn(),
      },
      bookListing: {
        create: vi.fn(),
      },
      bookListingImage: {
        createMany: vi.fn(),
      },
    };

    mockDb = {
      $transaction: vi.fn(async (callback: any) => await callback(mockTx)),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'usr_seller_1',
          isVerifiedSeller: true,
          shopProfile: { supportsParcel: true },
        }),
      },
      bookListing: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
    };
  });

  describe('createBookListing (Publish Book Listing)', () => {
    const validImages: CreateBookListingInput['images'] = [
      {
        imageUrl: 'https://storage.gongdong.com/front.webp',
        imageType: 'FRONT_COVER',
        displayOrder: 1,
        isCover: true,
      },
      {
        imageUrl: 'https://storage.gongdong.com/back.webp',
        imageType: 'BACK_COVER',
        displayOrder: 2,
      },
      {
        imageUrl: 'https://storage.gongdong.com/spine.webp',
        imageType: 'SPINE',
        displayOrder: 3,
      },
      {
        imageUrl: 'https://storage.gongdong.com/edge.webp',
        imageType: 'EDGE',
        displayOrder: 4,
      },
    ];

    const baseInput: CreateBookListingInput = {
      isbn: '978-616-18-4567-8',
      title: 'จิตวิทยาวาทะด้วยเงิน',
      author: 'Morgan Housel',
      publisher: 'Live Rich',
      category: 'จิตวิทยา / พัฒนาตนเอง',
      originalPrice: 290,
      price: 175,
      conditionAnswers: {
        spine: false,
        stains: false,
        markings: false,
        covers: false,
        pages: false,
      },
      allowPickup: true,
      pickupLat: 18.795,
      pickupLng: 98.952,
      pickupLocationName: 'หน้าหอสมุดกลาง มช.',
      allowDelivery: true,
      images: validImages,
    };

    it('กรณีสำเร็จ: ต้องคำนวณเกรด LIKE_NEW (0 ตำหนิ), Upsert แคตตาล็อกกลาง, และสร้างรายการขายพร้อมรูป 4 มุม', async () => {
      mockTx.bookCatalog.upsert.mockResolvedValue({});
      mockTx.bookListing.create.mockResolvedValue({
        id: 'bok_new_001',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        price: 175,
        status: 'AVAILABLE',
        createdAt: new Date('2026-11-12T16:00:00Z'),
      });
      mockTx.bookListingImage.createMany.mockResolvedValue({ count: 4 });

      const result = await createBookListing('usr_seller_1', baseInput, mockDb);

      // ตรวจสอบการคลีน ISBN และ Upsert ลง book_catalog โดยไม่เขียนทับแคตตาล็อกเดิมที่มีอยู่แล้ว
      expect(mockTx.bookCatalog.upsert).toHaveBeenCalledWith({
        where: { isbn: '9786161845678' },
        update: {},
        create: expect.objectContaining({
          isbn: '9786161845678',
          title: 'จิตวิทยาวาทะด้วยเงิน',
          author: 'Morgan Housel',
        }),
      });

      // ตรวจสอบการคำนวณเกรดอัตโนมัติบน Server (LIKE_NEW)
      expect(mockTx.bookListing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isbn: '9786161845678',
          sellerId: 'usr_seller_1',
          grade: 'LIKE_NEW',
          price: 175,
          status: 'AVAILABLE',
        }),
      });

      // ตรวจสอบการบันทึกรูปภาพ 4 มุม
      expect(mockTx.bookListingImage.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ imageType: 'FRONT_COVER', isCover: true }),
          expect.objectContaining({ imageType: 'BACK_COVER' }),
          expect.objectContaining({ imageType: 'SPINE' }),
          expect.objectContaining({ imageType: 'EDGE' }),
        ]),
      });

      expect(result).toEqual({
        id: 'bok_new_001',
        title: 'จิตวิทยาวาทะด้วยเงิน',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        categories: ['จิตวิทยา / พัฒนาตนเอง'],
        isSet: false,
        grade: 'LIKE_NEW',
        price: 175,
        recommendedPrice: 218, // Math.round(290 * 0.75 = 217.5)
        status: 'AVAILABLE',
        createdAt: new Date('2026-11-12T16:00:00Z'),
      });
    });

    it('ต้องคำนวณเกรดเป็น WELL_LOVED บน Server เมื่อมีรอยเปื้อน (stains) แม้ผู้ขายจะไม่ได้ระบุเกรดมา', async () => {
      mockTx.bookCatalog.upsert.mockResolvedValue({});
      mockTx.bookListing.create.mockResolvedValue({
        id: 'bok_new_002',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        price: 130,
        status: 'AVAILABLE',
        createdAt: new Date(),
      });

      const inputWithStain = {
        ...baseInput,
        conditionAnswers: {
          ...baseInput.conditionAnswers,
          stains: true,
        },
      };

      const result = await createBookListing('usr_seller_1', inputWithStain, mockDb);

      expect(result.grade).toBe('WELL_LOVED');
      expect(mockTx.bookListing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ grade: 'WELL_LOVED' }),
      });
    });

    it('ต้องปฏิเสธหากรูปภาพขาดมุมบังคับมุมใดมุมหนึ่ง (เช่น ขาด SPINE)', async () => {
      const incompleteImages = validImages.filter((img) => img.imageType !== 'SPINE');

      await expect(
        createBookListing(
          'usr_seller_1',
          { ...baseInput, images: incompleteImages },
          mockDb
        )
      ).rejects.toThrow('กรุณาถ่ายรูปให้ครบทั้ง 4 มุมบังคับ (ขาด: SPINE)');
    });

    it('ต้องปฏิเสธหากไม่ได้แนบรูปภาพมาเลย', async () => {
      await expect(
        createBookListing('usr_seller_1', { ...baseInput, images: [] }, mockDb)
      ).rejects.toThrow('กรุณาถ่ายรูปให้ครบทั้ง 4 มุมบังคับ');
    });

    it('ต้องปฏิเสธหากราคาขายติดลบ, ศูนย์ หรือ NaN (INVALID_PRICE)', async () => {
      await expect(
        createBookListing('usr_seller_1', { ...baseInput, price: -20 }, mockDb)
      ).rejects.toThrow('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ');
      await expect(
        createBookListing('usr_seller_1', { ...baseInput, price: 0 }, mockDb)
      ).rejects.toThrow('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ');
      await expect(
        createBookListing('usr_seller_1', { ...baseInput, price: NaN }, mockDb)
      ).rejects.toThrow('ราคาขายต้องเป็นตัวเลขและไม่ติดลบ');
    });

    it('ต้องปฏิเสธหากไม่ระบุชื่อหนังสือ หรือปิดช่องทางส่งมอบทั้งหมด หรือผู้ขายไม่ยืนยันตัวตนขอเปิดส่งพัสดุ', async () => {
      await expect(
        createBookListing('usr_seller_1', { ...baseInput, title: '   ' }, mockDb)
      ).rejects.toThrow('กรุณาระบุชื่อหนังสือ');

      await expect(
        createBookListing(
          'usr_seller_1',
          { ...baseInput, allowPickup: false, allowDelivery: false },
          mockDb
        )
      ).rejects.toThrow('กรุณาเลือกช่องทางการส่งมอบอย่างน้อย 1 วิธี');

      mockDb.user.findUnique.mockResolvedValueOnce({
        id: 'usr_unverified',
        isVerifiedSeller: false,
        shopProfile: { supportsParcel: false },
      });
      await expect(
        createBookListing('usr_unverified', { ...baseInput, allowDelivery: true }, mockDb)
      ).rejects.toThrow('ร้านค้าต้องยืนยันตัวตนและเปิดรับส่งพัสดุ');
    });
  });

  describe('getBookListings (Marketplace Feed & Search)', () => {
    const mockFeedListings = [
      {
        id: 'bok_1',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        grade: 'LIKE_NEW',
        price: 220,
        allowPickup: true,
        allowDelivery: true,
        pickupLocationName: 'หน้าหอสมุดกลาง มช.',
        bookCatalog: {
          title: 'Atomic Habits',
          author: 'James Clear',
          coverUrl: 'https://default.com/cover.webp',
          originalPrice: 295,
        },
        seller: {
          id: 'usr_seller_1',
          nickname: 'นนท์',
          avatarUrl: 'https://avatar.com/nont.webp',
          isVerifiedSeller: true,
        },
        images: [
          {
            imageUrl: 'https://storage.com/front.webp',
            isCover: true,
            displayOrder: 1,
          },
        ],
      },
    ];

    it('ควรดึง Feed รายการหนังสือและใช้รูปภาพปกจริงจากการลงขาย', async () => {
      mockDb.bookListing.findMany.mockResolvedValue(mockFeedListings);
      mockDb.bookListing.count.mockResolvedValue(1);

      const result = await getBookListings({}, mockDb);

      expect(mockDb.bookListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'AVAILABLE' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          skip: 0,
        })
      );

      expect(result.total).toBe(1);
      expect(result.books[0]).toEqual({
        id: 'bok_1',
        title: 'Atomic Habits',
        author: 'James Clear',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        categories: ['จิตวิทยา / พัฒนาตนเอง'],
        isSet: false,
        totalVolumes: null,
        coverImageUrl: 'https://storage.com/front.webp',
        price: 220,
        originalPrice: 295,
        grade: 'LIKE_NEW',
        allowPickup: true,
        pickupLocationName: 'หน้าหอสมุดกลาง มช.',
        allowDelivery: true,
        codEnabled: true,
        seller: {
          id: 'usr_seller_1',
          nickname: 'นนท์',
          shopName: null,
          avatarUrl: 'https://avatar.com/nont.webp',
          isVerifiedSeller: true,
        },
      });
    });

    it('ควรรองรับการกรองหมวดหมู่, เกรด, และคำค้นหา q', async () => {
      mockDb.bookListing.findMany.mockResolvedValue([]);
      mockDb.bookListing.count.mockResolvedValue(0);

      await getBookListings(
        {
          q: 'Habits',
          category: 'จิตวิทยา / พัฒนาตนเอง',
          grade: 'LIKE_NEW',
          shipping: 'PICKUP',
          limit: 10,
          offset: 20,
        },
        mockDb
      );

      expect(mockDb.bookListing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { status: 'AVAILABLE' },
              {
                OR: [
                  { category: 'จิตวิทยา / พัฒนาตนเอง' },
                  { categories: { has: 'จิตวิทยา / พัฒนาตนเอง' } },
                ],
              },
              { grade: 'LIKE_NEW' },
              { allowPickup: true },
              {
                OR: expect.arrayContaining([
                  { bookCatalog: { title: { contains: 'Habits', mode: 'insensitive' } } },
                ]),
              },
            ]),
          }),
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('getBookListingDetail (Product Detail & PDPA)', () => {
    it('ควรส่งข้อมูลสินค้าพร้อมแกลเลอรีรูปถ่ายเรียงตามลำดับ และซ่อนเบอร์โทรศัพท์ของผู้ขาย', async () => {
      const mockDetail = {
        id: 'bok_1',
        isbn: '9786161829029',
        category: 'จิตวิทยา / พัฒนาตนเอง',
        price: 220,
        grade: 'LIKE_NEW',
        conditionAnswers: { spine: false, stains: false, markings: false, covers: false, pages: false },
        allowPickup: true,
        pickupLat: 18.795,
        pickupLng: 98.952,
        pickupLocationName: 'หน้าหอสมุดกลาง มช.',
        allowDelivery: true,
        status: 'AVAILABLE',
        bookCatalog: {
          title: 'Atomic Habits',
          author: 'James Clear',
          publisher: 'I Learn',
          originalPrice: 295,
        },
        seller: {
          id: 'usr_seller_1',
          nickname: 'นนท์',
          avatarUrl: 'https://avatar.com/nont.webp',
          isVerifiedSeller: true,
        },
        images: [
          { id: 'img_1', imageUrl: 'https://storage/front.webp', imageType: 'FRONT_COVER', displayOrder: 1, isCover: true },
          { id: 'img_2', imageUrl: 'https://storage/back.webp', imageType: 'BACK_COVER', displayOrder: 2, isCover: false },
        ],
      };

      mockDb.bookListing.findUnique.mockResolvedValue(mockDetail);

      const result = await getBookListingDetail('bok_1', mockDb);

      expect(result.id).toBe('bok_1');
      expect(result.images.length).toBe(2);
      expect(result.seller).toEqual({
        id: 'usr_seller_1',
        nickname: 'นนท์',
        shopName: null,
        avatarUrl: 'https://avatar.com/nont.webp',
        isVerifiedSeller: true,
      });
      // ยืนยันว่าไม่มีเบอร์โทรหรือข้อมูลระบุตัวตนรั่วไหล
      expect((result.seller as any).phoneNumber).toBeUndefined();
      expect((result.seller as any).lineUserId).toBeUndefined();
    });

    it('ต้องปฏิเสธเมื่อไม่พบหนังสือ (BOOK_NOT_FOUND) หรือหนังสือถูกซ่อน (HIDDEN)', async () => {
      mockDb.bookListing.findUnique.mockResolvedValue(null);

      await expect(getBookListingDetail('bok_missing', mockDb)).rejects.toThrow(
        'ไม่พบหนังสือที่ระบุ'
      );

      mockDb.bookListing.findUnique.mockResolvedValueOnce({
        id: 'bok_hidden',
        status: 'HIDDEN',
      });
      await expect(getBookListingDetail('bok_hidden', mockDb)).rejects.toThrow(
        'ไม่พบหนังสือที่ระบุ'
      );
    });
  });

  describe('updateBookListing (Edit Listing S4)', () => {
    it('ต้องปฏิเสธการเปิดส่งพัสดุหากร้านยังไม่ยืนยันตัวตน และปฏิเสธหากปิดทั้งนัดรับและส่งพัสดุ', async () => {
      mockDb.bookListing.findUnique.mockResolvedValue({
        id: 'bok_1',
        sellerId: 'usr_seller_1',
        status: 'AVAILABLE',
        allowPickup: true,
        allowDelivery: false,
      });

      await expect(
        updateBookListing(
          'bok_1',
          'usr_seller_1',
          { allowPickup: false, allowDelivery: false },
          mockDb
        )
      ).rejects.toThrow('กรุณาเปิดรับการส่งมอบอย่างน้อย 1 ช่องทาง');

      mockDb.user.findUnique.mockResolvedValueOnce({
        id: 'usr_seller_1',
        isVerifiedSeller: false,
        shopProfile: { supportsParcel: true },
      });

      await expect(
        updateBookListing('bok_1', 'usr_seller_1', { allowDelivery: true }, mockDb)
      ).rejects.toThrow('ร้านค้าต้องยืนยันตัวตนและเปิดรับส่งพัสดุ');
    });
  });

  describe('getUserBookListings (My Shop S4)', () => {
    it('ควรดึงรายการหนังสือทั้งหมดที่เป็นของผู้ขายรายนั้น', async () => {
      mockDb.bookListing.findMany.mockResolvedValue([
        {
          id: 'bok_my_1',
          category: 'จิตวิทยา / พัฒนาตนเอง',
          price: 150,
          grade: 'WELL_LOVED',
          status: 'AVAILABLE',
          createdAt: new Date('2026-11-12T10:00:00Z'),
          bookCatalog: { title: 'หนังสือเล่มที่ 1' },
          images: [{ imageUrl: 'https://storage/cover.webp' }],
        },
      ]);

      const result = await getUserBookListings('usr_seller_1', mockDb);

      expect(mockDb.bookListing.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'usr_seller_1' },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });

      expect(result.books.length).toBe(1);
      expect(result.books[0].title).toBe('หนังสือเล่มที่ 1');
    });
  });

  describe('deleteBookListing (Delete Book)', () => {
    it('กรณีสำเร็จ: ลบรายการขายได้เมื่อเป็นเจ้าของและสถานะเป็น AVAILABLE', async () => {
      mockDb.bookListing.findUnique.mockResolvedValue({
        id: 'bok_1',
        sellerId: 'usr_seller_1',
        status: 'AVAILABLE',
      });
      mockDb.bookListing.delete.mockResolvedValue({});

      const result = await deleteBookListing('bok_1', 'usr_seller_1', mockDb);

      expect(mockDb.bookListing.delete).toHaveBeenCalledWith({
        where: { id: 'bok_1' },
      });
      expect(result.success).toBe(true);
    });

    it('ต้องปฏิเสธหากผู้ลบไม่ใช่เจ้าของประกาศ (FORBIDDEN)', async () => {
      mockDb.bookListing.findUnique.mockResolvedValue({
        id: 'bok_1',
        sellerId: 'usr_seller_1',
        status: 'AVAILABLE',
      });

      await expect(
        deleteBookListing('bok_1', 'usr_other_seller', mockDb)
      ).rejects.toThrow('คุณไม่มีสิทธิ์ลบรายการนี้');
    });

    it('ต้องปฏิเสธหากหนังสืออยู่ในสถานะติดจองหรือขายแล้ว (CANNOT_DELETE_ACTIVE_BOOK)', async () => {
      mockDb.bookListing.findUnique.mockResolvedValue({
        id: 'bok_1',
        sellerId: 'usr_seller_1',
        status: 'RESERVED',
      });

      await expect(
        deleteBookListing('bok_1', 'usr_seller_1', mockDb)
      ).rejects.toThrow('ไม่สามารถลบหนังสือที่ติดจองหรือขายสำเร็จแล้วได้');
    });
  });
});
