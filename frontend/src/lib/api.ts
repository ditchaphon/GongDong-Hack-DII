import { compressImageToWebp, dataUrlToFile } from './imageCompression';

export type UploadBucket =
  | 'book-listings'
  | 'avatars'
  | 'order-receives'
  | 'slips'
  | 'disputes';

export interface UploadImageResult {
  url: string;
  path: string;
  bucket: UploadBucket;
  isPrivate: boolean;
  isMocked: boolean;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let currentAuthToken: string | null = null;

export function setApiAuthToken(token: string | null): void {
  currentAuthToken = token;
}

export function getApiAuthToken(): string | null {
  return currentAuthToken;
}

export function getApiBaseUrl(): string {
  // On Vercel / behind a tunnel the browser calls same-origin /api/* and
  // Next.js proxies it to the backend (no mixed content, no localhost on phones).
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === 'true') return '';
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const base = configured || 'http://localhost:8000';
  return base.replace(/\/+$/, '');
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  token?: string | null;
}

interface BackendEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * Shared HTTP client for calling the GongDong Express Backend.
 * Automatically attaches Authorization: Bearer <idToken> and unwraps `{ success, data }`.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { body, headers: customHeaders, token, ...rest } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  const headers = new Headers(customHeaders);
  const authToken = token !== undefined ? token : currentAuthToken;

  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  let preparedBody: BodyInit | undefined;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && body !== null) {
    if (isFormData || typeof body === 'string' || body instanceof Blob) {
      preparedBody = body as BodyInit;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      preparedBody = JSON.stringify(body);
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: preparedBody,
  });

  const payload = (await response.json().catch(() => null)) as BackendEnvelope<T> | null;

  if (!response.ok || payload?.success === false) {
    const errorCode = payload?.error?.code || 'REQUEST_FAILED';
    const errorMessage =
      payload?.error?.message ||
      payload?.message ||
      `คำขอไม่สำเร็จ (HTTP ${response.status})`;
    throw new ApiError(errorMessage, response.status, errorCode, payload?.error?.details);
  }

  if (payload && 'data' in payload && payload.data !== undefined) {
    return payload.data;
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: ApiRequestOptions['body'], options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};

/**
 * Compress an image to WebP and upload it to Supabase Storage via Backend POST /api/upload.
 */
export async function uploadImageFile(
  input: File | string,
  bucket: UploadBucket,
  filename?: string
): Promise<UploadImageResult> {
  const rawFile =
    typeof input === 'string'
      ? await dataUrlToFile(input, filename || `capture-${Date.now()}.jpg`)
      : input;

  const compressedFile = await compressImageToWebp(rawFile);

  const formData = new FormData();
  formData.append('bucket', bucket);
  formData.append('file', compressedFile);

  return api.post<UploadImageResult>('/api/upload', formData);
}
