import { describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES, uploadImage, validateUploadInput } from '../uploadService';

describe('uploadService', () => {
  const validFile = {
    buffer: Buffer.from('fake-image-bytes'),
    mimetype: 'image/webp',
    originalname: 'cover.webp',
    size: 1024,
  };

  it('ปฏิเสธ Bucket ที่ไม่รู้จัก, ไฟล์ที่ใหญ่เกิน 5MB, และชนิดไฟล์ที่ไม่ใช่รูปภาพ', () => {
    expect(() => validateUploadInput('invalid-bucket', validFile)).toThrowError(/Bucket ไม่ถูกต้อง/);
    expect(() =>
      validateUploadInput('book-listings', { ...validFile, mimetype: 'application/pdf' })
    ).toThrowError(/รองรับเฉพาะไฟล์รูปภาพ/);
    expect(() =>
      validateUploadInput('book-listings', { ...validFile, size: MAX_UPLOAD_BYTES + 1 })
    ).toThrowError(/ขนาดไฟล์ต้องไม่เกิน 5 MB/);
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
});
