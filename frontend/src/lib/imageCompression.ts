import imageCompression from 'browser-image-compression';

const DEFAULT_MAX_SIZE_MB = 0.35;
const DEFAULT_MAX_DIMENSION = 1080;

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

function withWebpExtension(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.webp`;
}

/**
 * Compress and resize an image to WebP (max 1080px, ~100-350 KB) before upload
 * to keep Supabase Storage usage minimal and stay well below the 5 MB limit.
 */
export async function compressImageToWebp(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: DEFAULT_MAX_SIZE_MB,
      maxWidthOrHeight: DEFAULT_MAX_DIMENSION,
      fileType: 'image/webp',
      useWebWorker: true,
    });

    return new File([compressed], withWebpExtension(file.name), {
      type: 'image/webp',
    });
  } catch (err) {
    // Fallback to original file if browser-image-compression cannot decode in headless/legacy WebView
    console.warn('[imageCompression] Falling back to original file:', err);
    return file;
  }
}
