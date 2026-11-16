import { describe, expect, it, vi } from 'vitest';
import {
  deleteUploadedImage,
  extractStoragePathFromUrl,
  MAX_UPLOAD_BYTES,
  parseStorageRefFromUrl,
  removeUnreferencedStorageUrls,
  resolveSignedStorageUrl,
  uploadImage,
  validateUploadInput,
} from '../uploadService';

describe('uploadService', () => {
  const validWebpBuffer = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x18, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.from('fake-image-bytes'),
  ]);

  const validFile = {
    buffer: validWebpBuffer,
    mimetype: 'image/webp',
    originalname: 'cover.webp',
    size: 1024,
  };

  it('ปฏิเสธ Bucket ที่ไม่รู้จัก, ไฟล์ที่ใหญ่เกิน 5MB, ชนิดไฟล์ที่ไม่ใช่รูปภาพ และไฟล์ปลอมที่ magic bytes ไม่ตรง', () => {
    expect(() => validateUploadInput('invalid-bucket', validFile)).toThrowError(/Bucket ไม่ถูกต้อง/);
    expect(() =>
      validateUploadInput('book-listings', { ...validFile, mimetype: 'application/pdf' })
    ).toThrowError(/รองรับเฉพาะไฟล์รูปภาพ/);
    expect(() =>
      validateUploadInput('book-listings', {
        buffer: Buffer.from('%PDF-1.4 fake'),
        mimetype: 'image/jpeg',
        originalname: 'fake.jpg',
        size: 128,
      })
    ).toThrowError(/เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพ/);
    expect(() =>
      validateUploadInput('book-listings', { ...validFile, size: MAX_UPLOAD_BYTES + 1 })
    ).toThrowError(/ขนาดไฟล์ต้องไม่เกิน 5 MB/);
  });

  it('ยอมรับ magic bytes ของ JPEG, PNG และ WEBP อย่างถูกต้อง', () => {
    expect(
      validateUploadInput('book-listings', {
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]),
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        size: 5,
      })
    ).toBe('book-listings');

    expect(
      validateUploadInput('book-listings', {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
        mimetype: 'image/png',
        originalname: 'photo.png',
        size: 9,
      })
    ).toBe('book-listings');
  });

  it('คืนค่า Mock URL ในโหมด non-production เมื่อไม่มี Supabase Client', async () => {
    const res = await uploadImage('usr-1', 'book-listings', validFile, null);
    expect(res.isMocked).toBe(true);
    expect(res.isPrivate).toBe(false);
    expect(res.url).toContain('https://mock-storage.gongdong.local/book-listings/usr-1/');
  });

  it('ใช้ Signed URL สำหรับ Private Bucket (slips, disputes) เมื่อมี Supabase Client', async () => {
    const fakeSupabase: any = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://supabase.co/signed/slip.webp' },
            error: null,
          }),
          getPublicUrl: vi.fn(),
        }),
      },
    };

    const res = await uploadImage('usr-1', 'slips', validFile, fakeSupabase);
    expect(res.isMocked).toBe(false);
    expect(res.isPrivate).toBe(true);
    expect(res.url).toBe('https://supabase.co/signed/slip.webp');
  });

  it('extractStoragePathFromUrl และ resolveSignedStorageUrl ต้องแยกและ re-sign Private Slip Path ได้', async () => {
    expect(
      extractStoragePathFromUrl(
        'slips',
        'https://proj.supabase.co/storage/v1/object/sign/slips/usr-1/slip-123.webp?token=abc'
      )
    ).toBe('usr-1/slip-123.webp');

    expect(
      extractStoragePathFromUrl(
        'slips',
        'https://mock-storage.gongdong.local/slips/usr-1/mock-1.webp'
      )
    ).toBe('usr-1/mock-1.webp');

    const fakeSupabase: any = {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://proj.supabase.co/signed/fresh-url.webp' },
            error: null,
          }),
        }),
      },
    };

    const refreshed = await resolveSignedStorageUrl(
      'slips',
      'https://old-url.webp',
      'usr-1/slip-123.webp',
      fakeSupabase
    );
    expect(refreshed).toBe('https://proj.supabase.co/signed/fresh-url.webp');
  });

  it('ต้องปฏิเสธไฟล์ HEIC/HEIF ดิบด้วยรหัส UNSUPPORTED_HEIC_IMAGE และรองรับไฟล์ PNG ที่ถูกต้อง', () => {
    const heicHeader = Buffer.from([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70, // ftyp
      0x68, 0x65, 0x69, 0x63, // heic
    ]);

    expect(() =>
      validateUploadInput('book-listings', {
        buffer: heicHeader,
        mimetype: 'image/heic',
        originalname: 'iphone.heic',
        size: heicHeader.length,
      })
    ).toThrow(/HEIC\/HEIF/);

    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(
      validateUploadInput('book-listings', {
        buffer: pngBytes,
        mimetype: 'image/png',
        originalname: 'screenshot.png',
        size: pngBytes.length,
      })
    ).toBe('book-listings');
  });

  describe('deleteUploadedImage & removeUnreferencedStorageUrls', () => {
    it('ลบไฟล์ที่ผู้ใช้เป็นเจ้าของและยังไม่ถูกอ้างอิงใน DB ออกจาก Supabase Storage ได้', async () => {
      const removeMock = vi.fn().mockResolvedValue({ error: null });
      const fakeSupabase: any = {
        storage: {
          from: vi.fn().mockReturnValue({ remove: removeMock }),
        },
      };
      const fakeDb: any = {
        bookListingImage: { findFirst: vi.fn().mockResolvedValue(null) },
        bookCatalog: { findFirst: vi.fn().mockResolvedValue(null) },
      };

      const url =
        'https://proj.supabase.co/storage/v1/object/public/book-listings/usr-1/cover-old.webp';
      expect(parseStorageRefFromUrl(url)).toEqual({
        bucket: 'book-listings',
        path: 'usr-1/cover-old.webp',
        rawUrl: url,
      });

      const res = await deleteUploadedImage(
        'usr-1',
        { url },
        { prismaClient: fakeDb, supabaseClientOverride: fakeSupabase }
      );

      expect(fakeSupabase.storage.from).toHaveBeenCalledWith('book-listings');
      expect(removeMock).toHaveBeenCalledWith(['usr-1/cover-old.webp']);
      expect(res).toMatchObject({
        deleted: true,
        skipped: false,
        bucket: 'book-listings',
        path: 'usr-1/cover-old.webp',
      });
    });

    it('ปฏิเสธด้วย 403 FORBIDDEN เมื่อพยายามลบไฟล์ของ user อื่น หรือมี path traversal', async () => {
      const removeMock = vi.fn();
      const fakeSupabase: any = {
        storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
      };

      await expect(
        deleteUploadedImage(
          'usr-1',
          {
            url: 'https://proj.supabase.co/storage/v1/object/public/book-listings/usr-other/secret.webp',
          },
          { prismaClient: {}, supabaseClientOverride: fakeSupabase }
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      await expect(
        deleteUploadedImage(
          'usr-1',
          { bucket: 'book-listings', path: 'usr-1/../usr-other/secret.webp' },
          { prismaClient: {}, supabaseClientOverride: fakeSupabase }
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });

      expect(removeMock).not.toHaveBeenCalled();
    });

    it('ข้ามการลบ (REFERENCED_IN_DB) หากไฟล์ยังถูกอ้างอิงโดย BookListingImage หรือ BookCatalog', async () => {
      const removeMock = vi.fn();
      const fakeSupabase: any = {
        storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
      };
      const fakeDb: any = {
        bookListingImage: { findFirst: vi.fn().mockResolvedValue(null) },
        bookCatalog: { findFirst: vi.fn().mockResolvedValue({ isbn: '9786160000001' }) },
      };

      const res = await deleteUploadedImage(
        'usr-1',
        {
          url: 'https://proj.supabase.co/storage/v1/object/public/book-listings/usr-1/cover.webp',
        },
        { prismaClient: fakeDb, supabaseClientOverride: fakeSupabase }
      );

      expect(res).toMatchObject({
        deleted: false,
        skipped: true,
        reason: 'REFERENCED_IN_DB',
      });
      expect(removeMock).not.toHaveBeenCalled();
    });

    it('ข้าม URL ภายนอก (เช่น demo Unsplash) อย่างปลอดภัยโดยไม่เรียก storage.remove', async () => {
      const removeMock = vi.fn();
      const fakeSupabase: any = {
        storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
      };

      const res = await deleteUploadedImage(
        'usr-1',
        { url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600' },
        { prismaClient: {}, supabaseClientOverride: fakeSupabase }
      );

      expect(res).toEqual({
        deleted: false,
        skipped: true,
        reason: 'EXTERNAL_URL',
      });
      expect(removeMock).not.toHaveBeenCalled();
    });

    it('removeUnreferencedStorageUrls ลบเฉพาะ URL ที่ไม่มี record อ้างอิงแล้วแบบ batch', async () => {
      const removeMock = vi.fn().mockResolvedValue({ error: null });
      const fakeSupabase: any = {
        storage: { from: vi.fn().mockReturnValue({ remove: removeMock }) },
      };
      const coverUrl =
        'https://proj.supabase.co/storage/v1/object/public/book-listings/usr-1/cover.webp';
      const backUrl =
        'https://proj.supabase.co/storage/v1/object/public/book-listings/usr-1/back.webp';

      const fakeDb: any = {
        bookListingImage: { findFirst: vi.fn().mockResolvedValue(null) },
        bookCatalog: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            const matchesCover = JSON.stringify(where).includes('usr-1/cover.webp');
            return matchesCover ? { isbn: '9781234567890' } : null;
          }),
        },
      };

      const res = await removeUnreferencedStorageUrls([coverUrl, backUrl, backUrl], {
        expectedBucket: 'book-listings',
        ownerUserId: 'usr-1',
        prismaClient: fakeDb,
        supabaseClientOverride: fakeSupabase,
      });

      expect(res.removedPaths).toEqual(['usr-1/back.webp']);
      expect(removeMock).toHaveBeenCalledWith(['usr-1/back.webp']);
    });
  });
});
