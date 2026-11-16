import imageCompression from 'browser-image-compression';

const DEFAULT_MAX_SIZE_MB = 0.35;
const DEFAULT_MAX_DIMENSION = 1080;
const PNG_RECOMPRESS_THRESHOLD_BYTES = 800 * 1024;
const MAX_SAFE_VERCEL_BYTES = 3.5 * 1024 * 1024;

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

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

type SupportedImageMime = 'image/webp' | 'image/jpeg' | 'image/png';

/**
 * Convert a base64 Data URL (e.g. from canvas capture) into a File object.
 */
export async function dataUrlToFile(
  dataUrl: string,
  filename: string = `capture-${Date.now()}.jpg`
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new File([blob], filename, { type: mimeType });
}

function replaceExtension(name: string, ext: string): string {
  const stem = name.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.${ext}`;
}

function extForMime(mime: SupportedImageMime): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

function normalizeSupportedMime(mime?: string | null): SupportedImageMime {
  const lower = (mime || '').toLowerCase();
  if (lower === 'image/webp') return 'image/webp';
  if (lower === 'image/png') return 'image/png';
  return 'image/jpeg';
}

async function detectImageMimeType(blob: Blob, fallbackMime?: string): Promise<SupportedImageMime> {
  try {
    const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    // JPEG: FF D8 FF
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    ) {
      return 'image/png';
    }
    // WebP: RIFF....WEBP
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return 'image/webp';
    }
  } catch {
    // ignore slice/arrayBuffer errors and fallback to declared mime
  }

  if (blob.type) {
    const lower = blob.type.toLowerCase();
    if (lower === 'image/webp' || lower === 'image/png' || lower === 'image/jpeg' || lower === 'image/jpg') {
      return normalizeSupportedMime(lower);
    }
  }
  return normalizeSupportedMime(fallbackMime);
}

/**
 * ตรวจว่าไฟล์เป็น HEIC/HEIF จาก MIME, นามสกุลไฟล์ หรือ ISO BMFF ftyp magic bytes
 */
export async function isHeicFile(file: File): Promise<boolean> {
  const lowerMime = (file.type || '').toLowerCase();
  if (HEIC_MIME_TYPES.has(lowerMime)) return true;
  if (/\.(heic|heif)$/i.test(file.name)) return true;

  try {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (header.length >= 12) {
      const boxType = String.fromCharCode(header[4], header[5], header[6], header[7]);
      if (boxType === 'ftyp') {
        const brand = String.fromCharCode(header[8], header[9], header[10], header[11]).toLowerCase();
        if (HEIC_FTYP_BRANDS.has(brand)) return true;
      }
    }
  } catch {
    // ignore unreadable slice
  }

  return false;
}

/**
 * แปลงไฟล์ HEIC/HEIF จากกล้อง iPhone เป็น JPEG ฝั่ง client ก่อนพรีวิวหรืออัปโหลด
 * ไฟล์ที่ไม่ใช่ HEIC/HEIF จะถูกคืนค่ากลับทันทีโดยไม่เสียเวลาแปลง
 */
export async function prepareImageForPreviewAndUpload(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!(await isHeicFile(file))) return file;

  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.88,
    });
    const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
    if (!jpegBlob) {
      throw new Error('empty heic2any output');
    }
    return new File([jpegBlob], replaceExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
    });
  } catch (err) {
    console.warn('[imageCompression] HEIC/HEIF conversion failed:', err);
    throw new Error(
      'ไม่สามารถแปลงไฟล์รูปภาพ HEIC/HEIF ได้ กรุณาเลือกรูป JPG/PNG หรือถ่ายผ่านกล้องในแอปแทน'
    );
  }
}

async function runCompressionWithFallback(
  file: File,
  targetType: 'image/webp' | 'image/jpeg',
  maxSizeMB: number
): Promise<Blob> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: DEFAULT_MAX_DIMENSION,
    fileType: targetType,
    initialQuality: targetType === 'image/jpeg' ? 0.85 : undefined,
  };

  try {
    return await imageCompression(file, { ...options, useWebWorker: true });
  } catch {
    return await imageCompression(file, { ...options, useWebWorker: false });
  }
}

/**
 * Compress and resize an image (WebP when supported, otherwise actual PNG/JPEG MIME matching magic bytes)
 * so Supabase Storage and Vercel serverless limits are respected cleanly.
 */
export async function compressImageToWebp(file: File): Promise<File> {
  const normalized = await prepareImageForPreviewAndUpload(file);

  try {
    let compressed = await runCompressionWithFallback(normalized, 'image/webp', DEFAULT_MAX_SIZE_MB);
    let actualMime = await detectImageMimeType(compressed, normalized.type);

    // On browsers/WebViews without WebP canvas encoding (e.g. iOS Safari / LINE WKWebView),
    // canvas may return PNG bytes; re-compress oversized PNGs to JPEG to stay well under Vercel 4.5MB limit.
    if (
      (actualMime === 'image/png' && compressed.size > PNG_RECOMPRESS_THRESHOLD_BYTES) ||
      compressed.size > MAX_SAFE_VERCEL_BYTES
    ) {
      compressed = await runCompressionWithFallback(normalized, 'image/jpeg', DEFAULT_MAX_SIZE_MB);
      actualMime = await detectImageMimeType(compressed, 'image/jpeg');
    }

    return new File([compressed], replaceExtension(normalized.name, extForMime(actualMime)), {
      type: actualMime,
    });
  } catch (err) {
    console.warn('[imageCompression] Falling back to normalized image:', err);
    if (normalized.size > MAX_SAFE_VERCEL_BYTES) {
      throw new Error('ไฟล์รูปมีขนาดใหญ่เกินไป กรุณาลองย่อขนาดหรือเลือกรูปใหม่อีกครั้ง');
    }
    const fallbackMime = await detectImageMimeType(normalized, normalized.type);
    return new File([normalized], replaceExtension(normalized.name, extForMime(fallbackMime)), {
      type: fallbackMime,
    });
  }
}

/**
 * Compress an image file or data URL into a lightweight WebP/JPEG data URL
 * for local preview in draft state before deferred upload.
 */
export async function compressImageToDataUrl(input: File | string): Promise<string> {
  const rawFile =
    typeof input === 'string'
      ? await dataUrlToFile(input, `capture-${Date.now()}.jpg`)
      : input;
  const compressed = await compressImageToWebp(rawFile);

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ไม่สามารถอ่านข้อมูลรูปภาพที่บีบอัดแล้วได้'));
      }
    };
    reader.onerror = () => {
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่'));
    };
    reader.readAsDataURL(compressed);
  });
}
