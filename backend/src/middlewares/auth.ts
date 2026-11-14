import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { AppError, LineTokenPayload } from '../types';

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
  const liffChannelId = channelId || process.env.LINE_LIFF_CHANNEL_ID || process.env.LINE_CHANNEL_ID;

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

      // 1. ตรวจสอบโหมด Dev / Mock Bypass
      const isTestOrDev = process.env.NODE_ENV !== 'production';

      if (isTestOrDev && xUserId) {
        const user = await findUserByMockIdentifier(xUserId);
        if (user) {
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

      // ตรวจสอบ Mock Token ใน dev/test: เช่น Bearer mock_<uuid> หรือ mock_user_1
      if (isTestOrDev && token.startsWith('mock_')) {
        const mockTargetId = token.substring(5);
        const user = await findUserByMockIdentifier(mockTargetId);
        if (user) {
          req.user = user;
          req.userId = user.id;
          return next();
        }

        // กรณีเป็น mock token ใหม่ที่ต้องการ auto-create ในการทดสอบ
        const newUser = await prisma.$transaction(async (tx: any) => {
          const created = await tx.user.create({
            data: {
              lineUserId: `line_${mockTargetId}`,
              displayName: `Mock User (${mockTargetId})`,
              credits: 1,
              isVerifiedSeller: false,
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId: created.id,
              amount: 1,
              type: 'SIGNUP_BONUS',
            },
          });

          return created;
        });

        req.user = newUser;
        req.userId = newUser.id;
        return next();
      }

      // 2. Verify กับ LINE API
      const verifier = options.tokenVerifier || verifyLineToken;
      const payload = await verifier(token);

      const lineUserId = payload.sub;

      // 3. ค้นหาผู้ใช้ในฐานข้อมูล
      let user = await prisma.user.findUnique({
        where: { lineUserId },
      });

      // 4. หากเป็นผู้ใช้ใหม่ (First Login) ➔ Auto-create พร้อมแจก 1 เครดิตฟรี
      if (!user) {
        user = await prisma.$transaction(async (tx: any) => {
          const createdUser = await tx.user.create({
            data: {
              lineUserId,
              displayName: payload.name || 'LINE User',
              pictureUrl: payload.picture || null,
              credits: 1,
              isVerifiedSeller: false,
            },
          });

          await tx.creditTransaction.create({
            data: {
              userId: createdUser.id,
              amount: 1,
              type: 'SIGNUP_BONUS',
            },
          });

          return createdUser;
        });
      }

      if (!user) {
        throw new AppError('ไม่สามารถสร้างหรือระบุตัวตนผู้ใช้ได้', 500, 'USER_CREATION_FAILED');
      }

      req.user = user;
      req.userId = user.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authMiddleware = createAuthMiddleware();
