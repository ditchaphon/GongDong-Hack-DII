import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { AppError, UploadBucket } from '../types';

export const ALLOWED_UPLOAD_BUCKETS = new Set<UploadBucket>([
  'book-listings',
  'avatars',
  'order-receives',
  'slips',
  'disputes',
]);

export const PRIVATE_BUCKETS = new Set<UploadBucket>(['slips', 'disputes']);

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export interface UploadFileInput {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface UploadImageResult {
  url: string;
  path: string;
  bucket: UploadBucket;
  isPrivate: boolean;
  isMocked: boolean;
}

function getExtensionFromMime(mimetype: string, originalname: string): string {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpg';

  const ext = originalname.split('.').pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
}

function getSupabaseAdminClient(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasMatchingImageMagicBytes(mimetype: string, buffer: Buffer): boolean {
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

/**
 * ตรวจสอบความถูกต้องของ Bucket และไฟล์รูปภาพก่อนอัปโหลด
 */
export function validateUploadInput(bucket: string, file?: UploadFileInput): UploadBucket {
  if (!ALLOWED_UPLOAD_BUCKETS.has(bucket as UploadBucket)) {
    throw new AppError(
      `Bucket ไม่ถูกต้อง (รองรับ: ${Array.from(ALLOWED_UPLOAD_BUCKETS).join(', ')})`,
      400,
      'INVALID_UPLOAD_BUCKET'
    );
  }

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new AppError('กรุณาแนบไฟล์รูปภาพที่ต้องการอัปโหลด', 400, 'FILE_REQUIRED');
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      'รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG และ WEBP เท่านั้น',
      400,
      'INVALID_FILE_TYPE'
    );
  }

  if (!hasMatchingImageMagicBytes(file.mimetype, file.buffer)) {
    throw new AppError(
      'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพที่ระบุ (กรุณาอัปโหลดไฟล์ JPEG, PNG หรือ WEBP ที่สมบูรณ์)',
      400,
      'INVALID_FILE_CONTENT'
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError('ขนาดไฟล์ต้องไม่เกิน 5 MB', 400, 'FILE_TOO_LARGE');
  }

  return bucket as UploadBucket;
}

/**
 * อัปโหลดรูปภาพไปยัง Supabase Storage (หรือคืน Mock URL ในโหมด Dev/Test เมื่อยังไม่ได้ตั้งค่า Key)
 */
export async function uploadImage(
  userId: string,
  bucketInput: string,
  file?: UploadFileInput,
  supabaseClientOverride?: SupabaseClient | null
): Promise<UploadImageResult> {
  const bucket = validateUploadInput(bucketInput, file);
  const validFile = file!;
  const isPrivate = PRIVATE_BUCKETS.has(bucket);
  const ext = getExtensionFromMime(validFile.mimetype, validFile.originalname);
  const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const supabase =
    supabaseClientOverride !== undefined
      ? supabaseClientOverride
      : getSupabaseAdminClient();

  if (!supabase) {
    if (env.NODE_ENV === 'production') {
      throw new AppError(
        'ระบบอัปโหลดไฟล์ยังไม่พร้อมใช้งาน (Missing Supabase configuration)',
        503,
        'STORAGE_UNAVAILABLE'
      );
    }

    return {
      url: `https://mock-storage.gongdong.local/${bucket}/${filePath}`,
      path: filePath,
      bucket,
      isPrivate,
      isMocked: true,
    };
  }

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, validFile.buffer, {
      contentType: validFile.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw new AppError(
      `อัปโหลดไฟล์ไม่สำเร็จ: ${uploadError.message}`,
      502,
      'STORAGE_UPLOAD_FAILED'
    );
  }

  if (isPrivate) {
    const { data: signedData, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 วัน

    if (signError || !signedData?.signedUrl) {
      throw new AppError('ไม่สามารถสร้างลิงก์ไฟล์แบบปลอดภัยได้', 502, 'STORAGE_SIGN_FAILED');
    }

    return {
      url: signedData.signedUrl,
      path: filePath,
      bucket,
      isPrivate: true,
      isMocked: false,
    };
  }

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return {
    url: publicData.publicUrl,
    path: filePath,
    bucket,
    isPrivate: false,
    isMocked: false,
  };
}

/**
 * แยก storagePath ภายใน bucket ออกจาก Signed/Public URL หรือ Mock URL
 */
export function extractStoragePathFromUrl(
  bucket: UploadBucket,
  rawUrl?: string | null
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname;

    const mockPrefix = `/${bucket}/`;
    if (parsed.hostname === 'mock-storage.gongdong.local' && pathname.startsWith(mockPrefix)) {
      return pathname.slice(mockPrefix.length) || null;
    }

    const supaPatterns = [
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ];
    for (const prefix of supaPatterns) {
      const idx = pathname.indexOf(prefix);
      if (idx !== -1) {
        return decodeURIComponent(pathname.slice(idx + prefix.length)) || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * สร้าง Signed URL ใหม่จาก storagePath (ใช้ re-sign รูปใน Private Bucket เช่น slips หลังหมดอายุ 7 วัน)
 */
export async function resolveSignedStorageUrl(
  bucket: UploadBucket,
  fallbackUrl: string,
  storagePath?: string | null,
  supabaseClientOverride?: SupabaseClient | null
): Promise<string> {
  const cleanPath = storagePath?.trim();
  if (!cleanPath) {
    return fallbackUrl;
  }

  const supabase =
    supabaseClientOverride !== undefined
      ? supabaseClientOverride
      : getSupabaseAdminClient();

  if (!supabase) {
    return fallbackUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(cleanPath, 60 * 60 * 24 * 7);

  if (error || !data?.signedUrl) {
    return fallbackUrl;
  }

  return data.signedUrl;
}
