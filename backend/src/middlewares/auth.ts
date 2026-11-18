import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError, LineTokenPayload } from '../types';

const LINE_TOKEN_CACHE_TTL_MS = 60 * 1000;
const verifiedLineTokenCache = new Map<
  string,
  { payload: LineTokenPayload; expiresAtMs: number }
>();

export function clearVerifiedLineTokenCacheForTest(): void {
  verifiedLineTokenCache.clear();
}

function getTokenCacheKey(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function verifyLineTokenCached(token: string): Promise<LineTokenPayload> {
  const key = getTokenCacheKey(token);
  const now = Date.now();
  const cached = verifiedLineTokenCache.get(key);
  if (cached && cached.expiresAtMs > now) {
    return cached.payload;
  }

  const payload = await verifyLineToken(token);
  const tokenExpMs =
    typeof payload.exp === 'number' && Number.isFinite(payload.exp)
      ? payload.exp * 1000 - 5_000
      : now + LINE_TOKEN_CACHE_TTL_MS;
  const expiresAtMs = Math.min(now + LINE_TOKEN_CACHE_TTL_MS, tokenExpMs);

  if (expiresAtMs > now) {
    if (verifiedLineTokenCache.size > 2000) {
      for (const [entryKey, entry] of verifiedLineTokenCache.entries()) {
        if (entry.expiresAtMs <= now) verifiedLineTokenCache.delete(entryKey);
      }
    }
    verifiedLineTokenCache.set(key, { payload, expiresAtMs });
  }

  return payload;
}

declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: string;
    }
  }
}

/**
 * ฟังก์ชันสำหรับ Verify LIFF ID Token กับ LINE OAuth 2.1 Verify API
 */
export async function verifyLineToken(
  idToken: string,
  channelId?: string,
  fetchFn: typeof fetch = fetch
): Promise<LineTokenPayload> {
  const liffChannelId =
    channelId ||
    process.env.LINE_LIFF_CHANNEL_ID ||
    process.env.LINE_LOGIN_CHANNEL_ID ||
    process.env.LINE_CHANNEL_ID;

  if (process.env.NODE_ENV === 'production' && !liffChannelId) {
    throw new AppError(
      'ระบบยืนยันตัวตน LINE ยังไม่ได้ตั้งค่า LINE_LOGIN_CHANNEL_ID',
      503,
      'LINE_AUTH_NOT_CONFIGURED'
    );
  }

  const bodyParams = new URLSearchParams();
  bodyParams.append('id_token', idToken);
  if (liffChannelId) {
    bodyParams.append('client_id', liffChannelId);
  }

  const response = await fetchFn('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as any;
    throw new AppError(
      errorData.error_description || 'LIFF ID Token ไม่ถูกต้องหรือหมดอายุ',
      401,
      'UNAUTHORIZED',
      errorData
    );
  }

  const payload = (await response.json()) as LineTokenPayload;
  if (!payload || !payload.sub) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ใน Token (Invalid Token Payload)', 401, 'UNAUTHORIZED');
  }

  return payload;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ค้นหาผู้ใช้จาก Mock ID หรือ LINE User ID (ป้องกัน Prisma P2023 เมื่อ Identifier ไม่ใช่ UUID)
 */
async function findUserByMockIdentifier(identifier: string) {
  if (UUID_REGEX.test(identifier)) {
    const byId = await prisma.user.findUnique({ where: { id: identifier } });
    if (byId) return byId;
  }

  const byLineId = await prisma.user.findUnique({ where: { lineUserId: identifier } });
  if (byLineId) return byLineId;

  return prisma.user.findUnique({ where: { lineUserId: `line_${identifier}` } });
}

async function findOrCreateFirstLoginUser(data: {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string | null;
}) {
  try {
    return await prisma.$transaction(async (tx: any) => {
      const createdUser = await tx.user.create({
        data: {
          lineUserId: data.lineUserId,
          displayName: data.displayName,
          ...(data.pictureUrl !== undefined ? { pictureUrl: data.pictureUrl } : {}),
          credits: 1,
          isVerifiedSeller: false,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: createdUser.id,
          amount: 1,
          balanceAfter: 1,
          type: 'SIGNUP_BONUS',
          note: 'เครดิตฟรีสำหรับผู้ใช้ใหม่',
        },
      });

      return createdUser;
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const existing = await prisma.user.findUnique({
        where: { lineUserId: data.lineUserId },
      });
      if (existing) return existing;
    }
    throw err;
  }
}

const PRESENCE_THROTTLE_MS = 60 * 1000;

function touchUserLastActive(user: any): void {
  if (!user?.id || typeof prisma?.user?.update !== 'function') {
    return;
  }
  const lastActiveMs = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < PRESENCE_THROTTLE_MS) {
    return;
  }
  const now = new Date();
  user.lastActiveAt = now;
  Promise.resolve(
    prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: now },
    })
  ).catch(() => {
    /* Presence tracking must never block API requests */
  });
}

export interface AuthMiddlewareOptions {
  tokenVerifier?: (token: string) => Promise<LineTokenPayload>;
}

/**
 * Authentication Middleware สำหรับ Express
 * ตรวจสอบ Token จาก Header Authorization: Bearer <token>
 * - รองรับ Dual-mode: Mock Token (mock_<userId>) หรือ Header x-user-id ในการทดสอบ
 * - หากเป็น LIFF ID Token จริง ตรวจสอบผ่าน LINE OAuth API
 * - หากเป็นผู้ใช้ใหม่ ทำการ Auto-create User ในฐานข้อมูล พร้อมแจก 1 เครดิตฟรี (SIGNUP_BONUS)
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const xUserId = req.headers['x-user-id'] as string | undefined;

      // 1. ตรวจสอบโหมด Dev / Mock Bypass (ต้องเป็น test หรือเปิด ENABLE_MOCK_AUTH=true เท่านั้น)
      const isMockAuthEnabled =
        process.env.NODE_ENV === 'test' ||
        (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AUTH === 'true');

      if (isMockAuthEnabled && xUserId) {
        const user = await findUserByMockIdentifier(xUserId);
        if (user) {
          touchUserLastActive(user);
          req.user = user;
          req.userId = user.id;
          return next();
        }
      }

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('กรุณาเข้าสู่ระบบก่อนดำเนินการ (Missing or Invalid Authorization Header)', 401, 'UNAUTHORIZED');
      }

      const token = authHeader.substring(7).trim();
      if (!token) {
        throw new AppError('กรุณาแนบ Token สำหรับยืนยันตัวตน', 401, 'UNAUTHORIZED');
      }

      // ตรวจสอบ Mock Token ใน test หรือ dev ที่เปิด ENABLE_MOCK_AUTH=true
      if (isMockAuthEnabled && token.startsWith('mock_')) {
        const mockTargetId = token.substring(5);
        const user = await findUserByMockIdentifier(mockTargetId);
        if (user) {
          touchUserLastActive(user);
          req.user = user;
          req.userId = user.id;
          return next();
        }

        // กรณีเป็น mock token ใหม่ที่ต้องการ auto-create ในการทดสอบ (รองรับ Concurrent P2002)
        const newUser = await findOrCreateFirstLoginUser({
          lineUserId: `line_${mockTargetId}`,
          displayName: `Mock User (${mockTargetId})`,
        });

        touchUserLastActive(newUser);
        req.user = newUser;
        req.userId = newUser.id;
        return next();
      }

      // 2. Verify กับ LINE API (ใช้ cache 60 วินาทีเฉพาะ production verifier เพื่อลด roundtrip)
      const payload = options.tokenVerifier
        ? await options.tokenVerifier(token)
        : await verifyLineTokenCached(token);

      const lineUserId = payload.sub;

      // 3. ค้นหาผู้ใช้ในฐานข้อมูล
      let user = await prisma.user.findUnique({
        where: { lineUserId },
      });

      // 4. หากเป็นผู้ใช้ใหม่ (First Login) ➔ Auto-create พร้อมแจก 1 เครดิตฟรี (รองรับ Concurrent P2002)
      if (!user) {
        user = await findOrCreateFirstLoginUser({
          lineUserId,
          displayName: payload.name || 'LINE User',
          pictureUrl: payload.picture || null,
        });
      }

      if (!user) {
        throw new AppError('ไม่สามารถสร้างหรือระบุตัวตนผู้ใช้ได้', 500, 'USER_CREATION_FAILED');
      }

      touchUserLastActive(user);
      req.user = user;
      req.userId = user.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authMiddleware = createAuthMiddleware();
