import { describe, expect, it, vi } from 'vitest';
import { createAuthMiddleware, verifyLineToken } from '../auth';

const mockFindUnique = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

describe('authMiddleware', () => {
  it('ควรโยน Error 401 UNAUTHORIZED เมื่อไม่มี Authorization header', async () => {
    const middleware = createAuthMiddleware();
    const req: any = { headers: {} };
    const res: any = {};
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      })
    );
  });

  it('ควรโยน Error 401 UNAUTHORIZED เมื่อ Authorization header ไม่ได้ขึ้นต้นด้วย Bearer', async () => {
    const middleware = createAuthMiddleware();
    const req: any = { headers: { authorization: 'Basic some-credentials' } };
    const res: any = {};
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        code: 'UNAUTHORIZED',
      })
    );
  });

  it('ควรยอมรับ Mock Token ในโหมด Dev/Test และกำหนด req.user ให้ถูกต้อง', async () => {
    const middleware = createAuthMiddleware({
      tokenVerifier: vi.fn(),
    });

    const mockUser = {
      id: 'usr-1',
      lineUserId: 'line-1',
      displayName: 'Mock User',
    };

    mockFindUnique.mockImplementation(({ where }) => {
      if (where.id === 'usr-1' || where.lineUserId === 'usr-1') {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve(null);
    });

    const req: any = { headers: { authorization: 'Bearer mock_usr-1' } };
    const res: any = {};
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe('usr-1');
  });

  it('ไม่ควร query id เมื่อ Mock Token ไม่ใช่ UUID และควรพบ user ที่ถูก auto-create ด้วย prefix line_', async () => {
    const middleware = createAuthMiddleware({
      tokenVerifier: vi.fn(),
    });

    const autoCreatedUser = {
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      lineUserId: 'line_usr_mock_01',
      displayName: 'Mock User (usr_mock_01)',
    };

    mockFindUnique.mockReset();
    mockFindUnique.mockImplementation(({ where }) => {
      if (where.lineUserId === 'line_usr_mock_01') {
        return Promise.resolve(autoCreatedUser);
      }
      return Promise.resolve(null);
    });

    const req: any = { headers: { authorization: 'Bearer mock_usr_mock_01' } };
    const res: any = {};
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockFindUnique).not.toHaveBeenCalledWith({ where: { id: 'usr_mock_01' } });
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe(autoCreatedUser.id);
  });

  it('ควร Auto-create ผู้ใช้ใหม่และแจก 1 เครดิตฟรี เมื่อเป็น First Login จาก LINE API', async () => {
    const mockVerifier = vi.fn().mockResolvedValue({
      sub: 'U_NEW_LINE_USER_999',
      name: 'ฟ้าใส ใจดี',
      picture: 'https://example.com/pic.jpg',
    });

    mockFindUnique.mockResolvedValue(null); // ผู้ใช้ยังไม่มีใน DB
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        user: {
          create: vi.fn().mockResolvedValue({
            id: 'new-usr-999',
            lineUserId: 'U_NEW_LINE_USER_999',
            displayName: 'ฟ้าใส ใจดี',
            credits: 1,
            isVerifiedSeller: false,
          }),
        },
        creditTransaction: {
          create: vi.fn().mockResolvedValue({ id: 'tx-1' }),
        },
      };
      return callback(tx);
    });

    const middleware = createAuthMiddleware({
      tokenVerifier: mockVerifier,
    });

    const req: any = { headers: { authorization: 'Bearer real_liff_token_sample' } };
    const res: any = {};
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockVerifier).toHaveBeenCalledWith('real_liff_token_sample');
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.userId).toBe('new-usr-999');
  });
});

describe('verifyLineToken helper', () => {
  it('ควรเรียก LINE API ด้วย id_token และแปลง Payload สำเร็จ', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        sub: 'U_12345678',
        name: 'LINE Reader',
        picture: 'https://profile.line.me/pic.png',
      }),
    });

    const result = await verifyLineToken('sample_token', '1234567890', mockFetch as any);

    expect(result.sub).toBe('U_12345678');
    expect(result.name).toBe('LINE Reader');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.line.me/oauth2/v2.1/verify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
  });

  it('ควรโยน Error 401 UNAUTHORIZED เมื่อ LINE API ตอบกลับว่า token ผิดพลาด', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: 'invalid_request',
        error_description: 'IdToken is expired',
      }),
    });

    await expect(
      verifyLineToken('expired_token', '1234567890', mockFetch as any)
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'IdToken is expired',
    });
  });
});
