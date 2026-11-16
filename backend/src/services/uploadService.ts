import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { prisma as defaultPrisma } from '../config/prisma';
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

const HEIC_FTYP_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
]);

function isHeicImage(mimetype: string, buffer: Buffer): boolean {
  const lower = mimetype.toLowerCase();
  if (
    lower === 'image/heic' ||
    lower === 'image/heif' ||
    lower === 'image/heic-sequence' ||
    lower === 'image/heif-sequence'
  ) {
    return true;
  }

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    return HEIC_FTYP_BRANDS.has(brand);
  }
  return false;
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

  const normalizedMime = file.mimetype.toLowerCase();

  if (isHeicImage(normalizedMime, file.buffer)) {
    throw new AppError(
      'ไฟล์รูปภาพแบบ HEIC/HEIF ยังไม่ถูกแปลงเป็น JPEG กรุณาลองเลือกไฟล์ใหม่อีกครั้งหรือใช้ไฟล์ JPG/PNG/WEBP',
      400,
      'UNSUPPORTED_HEIC_IMAGE'
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) {
    throw new AppError(
      'รองรับเฉพาะไฟล์รูปภาพ JPEG, PNG และ WEBP เท่านั้น',
      400,
      'INVALID_FILE_TYPE'
    );
  }

  if (!hasMatchingImageMagicBytes(normalizedMime, file.buffer)) {
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

export interface StorageObjectRef {
  bucket: UploadBucket;
  path: string;
  rawUrl: string;
}

export interface DeleteUploadedImageResult {
  deleted: boolean;
  skipped: boolean;
  reason?: 'EXTERNAL_URL' | 'REFERENCED_IN_DB';
  bucket?: UploadBucket;
  path?: string;
  isMocked?: boolean;
}

/**
 * แปลง Public/Signed/Mock Storage URL เป็น { bucket, path }
 */
export function parseStorageRefFromUrl(rawUrl?: string | null): StorageObjectRef | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  for (const bucket of ALLOWED_UPLOAD_BUCKETS) {
    const path = extractStoragePathFromUrl(bucket, trimmed);
    if (path) {
      return { bucket, path, rawUrl: trimmed };
    }
  }
  return null;
}

function isSafeOwnedStoragePath(userId: string, storagePath: string): boolean {
  if (!storagePath || storagePath.startsWith('/')) return false;
  if (storagePath.split('/').includes('..')) return false;
  return storagePath.startsWith(`${userId}/`);
}

function buildUrlMatchFilter(field: string, rawUrl: string, storagePath: string) {
  const suffix = `/${storagePath}`;
  return {
    OR: [{ [field]: rawUrl }, { [field]: { endsWith: suffix } }],
  };
}

/**
 * ตรวจสอบว่า URL หรือ path ของไฟล์ยังถูกอ้างอิงอยู่ในฐานข้อมูลหรือไม่
 */
export async function isStorageUrlReferencedInDb(
  db: any,
  bucket: UploadBucket,
  rawUrl: string,
  storagePath: string
): Promise<boolean> {
  if (!db) return false;

  if (bucket === 'book-listings') {
    const [imgRef, catalogRef] = await Promise.all([
      db.bookListingImage?.findFirst
        ? db.bookListingImage.findFirst({
            where: buildUrlMatchFilter('imageUrl', rawUrl, storagePath),
            select: { id: true },
          })
        : null,
      db.bookCatalog?.findFirst
        ? db.bookCatalog.findFirst({
            where: buildUrlMatchFilter('coverUrl', rawUrl, storagePath),
            select: { isbn: true },
          })
        : null,
    ]);
    return Boolean(imgRef || catalogRef);
  }

  if (bucket === 'avatars') {
    const [userRef, shopRef] = await Promise.all([
      db.user?.findFirst
        ? db.user.findFirst({
            where: buildUrlMatchFilter('avatarUrl', rawUrl, storagePath),
            select: { id: true },
          })
        : null,
      db.shopProfile?.findFirst
        ? db.shopProfile.findFirst({
            where: buildUrlMatchFilter('avatarUrl', rawUrl, storagePath),
            select: { id: true },
          })
        : null,
    ]);
    return Boolean(userRef || shopRef);
  }

  if (bucket === 'order-receives') {
    const [orderRef, deliveryRef] = await Promise.all([
      db.order?.findFirst
        ? db.order.findFirst({
            where: buildUrlMatchFilter('receivedPhotoUrl', rawUrl, storagePath),
            select: { id: true },
          })
        : null,
      db.orderDeliveryDetail?.findFirst
        ? db.orderDeliveryDetail.findFirst({
            where: buildUrlMatchFilter('parcelImageUrl', rawUrl, storagePath),
            select: { id: true },
          })
        : null,
    ]);
    return Boolean(orderRef || deliveryRef);
  }

  if (bucket === 'slips') {
    if (!db.paymentSlip?.findFirst) return false;
    const slipRef = await db.paymentSlip.findFirst({
      where: {
        OR: [
          { slipImageUrl: rawUrl },
          { slipImageUrl: { endsWith: `/${storagePath}` } },
          { storagePath },
        ],
      },
      select: { id: true },
    });
    return Boolean(slipRef);
  }

  return false;
}

async function removeStoragePaths(
  bucket: UploadBucket,
  paths: string[],
  supabaseClientOverride?: SupabaseClient | null
): Promise<{ isMocked: boolean }> {
  const uniquePaths = Array.from(new Set(paths.map((p) => p.trim()).filter(Boolean)));
  if (uniquePaths.length === 0) {
    return { isMocked: false };
  }

  const supabase =
    supabaseClientOverride !== undefined
      ? supabaseClientOverride
      : getSupabaseAdminClient();

  if (!supabase) {
    return { isMocked: true };
  }

  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);
  if (error) {
    throw new AppError(
      `ลบไฟล์ออกจาก Storage ไม่สำเร็จ: ${error.message}`,
      502,
      'STORAGE_DELETE_FAILED'
    );
  }

  return { isMocked: false };
}

/**
 * ลบไฟล์รูปภาพที่ผู้ใช้อัปโหลดไว้ (ตรวจสิทธิ์เจ้าของ path และตรวจว่าไม่ถูกอ้างอิงใน DB)
 */
export async function deleteUploadedImage(
  userId: string,
  input: { url?: string; bucket?: string; path?: string },
  options?: {
    prismaClient?: any;
    supabaseClientOverride?: SupabaseClient | null;
  }
): Promise<DeleteUploadedImageResult> {
  const db = options?.prismaClient || defaultPrisma;

  let bucket: UploadBucket | null = null;
  let storagePath = '';
  let rawUrl = '';

  if (input.url && input.url.trim()) {
    const parsed = parseStorageRefFromUrl(input.url);
    if (!parsed) {
      return { deleted: false, skipped: true, reason: 'EXTERNAL_URL' };
    }
    bucket = parsed.bucket;
    storagePath = parsed.path;
    rawUrl = parsed.rawUrl;
  } else if (input.bucket && input.path) {
    if (!ALLOWED_UPLOAD_BUCKETS.has(input.bucket as UploadBucket)) {
      throw new AppError('Bucket ไม่ถูกต้อง', 400, 'INVALID_UPLOAD_BUCKET');
    }
    bucket = input.bucket as UploadBucket;
    storagePath = input.path.trim();
  } else {
    throw new AppError('กรุณาระบุ URL หรือ path ของไฟล์ที่ต้องการลบ', 400, 'MISSING_FILE_REF');
  }

  if (!isSafeOwnedStoragePath(userId, storagePath)) {
    throw new AppError('คุณไม่มีสิทธิ์ลบไฟล์นี้', 403, 'FORBIDDEN');
  }

  const isReferenced = await isStorageUrlReferencedInDb(db, bucket, rawUrl, storagePath);
  if (isReferenced) {
    return {
      deleted: false,
      skipped: true,
      reason: 'REFERENCED_IN_DB',
      bucket,
      path: storagePath,
    };
  }

  const { isMocked } = await removeStoragePaths(
    bucket,
    [storagePath],
    options?.supabaseClientOverride
  );

  return {
    deleted: true,
    skipped: false,
    bucket,
    path: storagePath,
    isMocked,
  };
}

/**
 * Best-effort cleanup สำหรับชุด URL ของประกาศ/รายการที่ถูกลบ (ลบเฉพาะไฟล์ที่ไม่มี record อ้างอิงแล้ว)
 */
export async function removeUnreferencedStorageUrls(
  urls: Array<string | null | undefined>,
  options?: {
    expectedBucket?: UploadBucket;
    ownerUserId?: string;
    prismaClient?: any;
    supabaseClientOverride?: SupabaseClient | null;
  }
): Promise<{ removedPaths: string[] }> {
  const db = options?.prismaClient || defaultPrisma;
  const refsByKey = new Map<string, StorageObjectRef>();

  for (const raw of urls) {
    const parsed = parseStorageRefFromUrl(raw);
    if (!parsed) continue;
    if (options?.expectedBucket && parsed.bucket !== options.expectedBucket) continue;
    if (options?.ownerUserId && !isSafeOwnedStoragePath(options.ownerUserId, parsed.path)) {
      continue;
    }
    refsByKey.set(`${parsed.bucket}:${parsed.path}`, parsed);
  }

  if (refsByKey.size === 0) {
    return { removedPaths: [] };
  }

  const pathsByBucket = new Map<UploadBucket, string[]>();
  for (const ref of refsByKey.values()) {
    const stillReferenced = await isStorageUrlReferencedInDb(
      db,
      ref.bucket,
      ref.rawUrl,
      ref.path
    ).catch(() => true);
    if (stillReferenced) continue;

    const list = pathsByBucket.get(ref.bucket) ?? [];
    list.push(ref.path);
    pathsByBucket.set(ref.bucket, list);
  }

  const removedPaths: string[] = [];
  for (const [bucket, paths] of pathsByBucket.entries()) {
    try {
      await removeStoragePaths(bucket, paths, options?.supabaseClientOverride);
      removedPaths.push(...paths);
    } catch (err) {
      console.warn(`[uploadService] Failed to cleanup storage (${bucket}):`, err);
    }
  }

  return { removedPaths };
}
