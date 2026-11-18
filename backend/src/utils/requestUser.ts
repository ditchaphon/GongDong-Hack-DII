import { Request } from 'express';
import { AppError } from '../types';

/**
 * ดึง userId ของผู้ใช้ที่ผ่านการยืนยันตัวตนจาก Request
 */
export function getUserIdFromRequest(req: Request): string {
  const userId = req.userId || ((req as any).user?.id as string | undefined);

  if (!userId) {
    throw new AppError(
      'กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized)',
      401,
      'UNAUTHORIZED'
    );
  }

  return userId;
}
