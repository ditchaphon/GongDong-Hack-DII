import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminAuthMiddleware } from '../admin';

const mockFindUnique = vi.fn();

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
}));

describe('adminAuthMiddleware (Dual Admin Auth: ADMIN_API_KEY + ADMIN_LINE_USER_IDS)', () => {
  const prevApiKey = process.env.ADMIN_API_KEY;
  const prevAdminIds = process.env.ADMIN_LINE_USER_IDS;

  afterEach(() => {
    mockFindUnique.mockReset();
    if (prevApiKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = prevApiKey;

    if (prevAdminIds === undefined) delete process.env.ADMIN_LINE_USER_IDS;
    else process.env.ADMIN_LINE_USER_IDS = prevAdminIds;
  });

  it('คืน 503 ADMIN_NOT_CONFIGURED เมื่อไม่ได้ตั้งค่าทั้ง ADMIN_API_KEY และ ADMIN_LINE_USER_IDS', async () => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_LINE_USER_IDS;

    const req: any = { header: () => undefined, headers: {} };
    const next = vi.fn();

    await adminAuthMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        code: 'ADMIN_NOT_CONFIGURED',
      })
    );
  });

  it('อนุญาตให้ผ่านเมื่อส่ง x-admin-key ตรงกับ ADMIN_API_KEY', async () => {
    process.env.ADMIN_API_KEY = 'super-secret-admin-key';
    delete process.env.ADMIN_LINE_USER_IDS;

    const req: any = {
      header: (name: string) =>
        name.toLowerCase() === 'x-admin-key' ? 'super-secret-admin-key' : undefined,
      headers: {},
    };
    const next = vi.fn();

    await adminAuthMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('อนุญาตให้ LINE User ที่อยู่ใน ADMIN_LINE_USER_IDS ผ่านได้ด้วย Bearer token', async () => {
    delete process.env.ADMIN_API_KEY;
    process.env.ADMIN_LINE_USER_IDS = 'U_ADMIN_001, U_ADMIN_002';

    mockFindUnique.mockResolvedValue({
      id: 'usr-admin-1',
      lineUserId: 'U_ADMIN_001',
      displayName: 'Admin One',
    });

    const req: any = {
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer mock_U_ADMIN_001' : undefined,
      headers: { authorization: 'Bearer mock_U_ADMIN_001' },
    };
    const next = vi.fn();

    await adminAuthMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user?.lineUserId).toBe('U_ADMIN_001');
  });

  it('ปฏิเสธด้วย 403 FORBIDDEN เมื่อ User ทั่วไป (ไม่อยู่ใน ADMIN_LINE_USER_IDS) พยายามเข้าถึง', async () => {
    delete process.env.ADMIN_API_KEY;
    process.env.ADMIN_LINE_USER_IDS = 'U_ADMIN_001';

    mockFindUnique.mockResolvedValue({
      id: 'usr-normal-1',
      lineUserId: 'U_NORMAL_999',
      displayName: 'Normal User',
    });

    const req: any = {
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? 'Bearer mock_U_NORMAL_999' : undefined,
      headers: { authorization: 'Bearer mock_U_NORMAL_999' },
    };
    const next = vi.fn();

    await adminAuthMiddleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        code: 'FORBIDDEN',
      })
    );
  });
});
