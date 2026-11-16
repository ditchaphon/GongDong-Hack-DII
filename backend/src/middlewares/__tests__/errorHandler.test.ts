import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../errorHandler';

function createMockRes() {
  const res: any = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  it('ควรแปลง Prisma P2028 (Transaction not found/timeout) เป็น HTTP 503 DATABASE_TIMEOUT ภาษาไทย', () => {
    const err: any = new Error(
      'Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn\'t have information about anymore, or was obtained before disconnecting.'
    );
    err.code = 'P2028';
    const res = createMockRes();

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'DATABASE_TIMEOUT',
          message: 'การเชื่อมต่อฐานข้อมูลใช้เวลานานเกินกำหนด กรุณาลองใหม่อีกครั้ง',
        }),
      })
    );
  });

  it('ควรแปลง Prisma P2024 (Connection pool timeout) เป็น HTTP 503 DATABASE_TIMEOUT ภาษาไทย', () => {
    const err: any = new Error('Timed out fetching a new connection from the connection pool.');
    err.code = 'P2024';
    const res = createMockRes();

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'DATABASE_TIMEOUT',
        }),
      })
    );
  });
});
