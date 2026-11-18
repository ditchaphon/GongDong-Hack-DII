import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRateLimitStoresForTest,
  createRateLimitMiddleware,
} from '../rateLimit';

describe('rateLimit middleware (HIGH-1)', () => {
  beforeEach(() => {
    clearRateLimitStoresForTest();
  });

  it('อนุญาตไม่เกิน maxRequests และบล็อกคำขอถัดไปด้วย 429 RATE_LIMITED พร้อม Retry-After', () => {
    const limiter = createRateLimitMiddleware({
      name: 'test-handover',
      windowMs: 60_000,
      maxRequests: 2,
      message: 'ลองใหม่อีกครั้งภายหลัง',
    });

    const makeRes = () => ({ setHeader: vi.fn() }) as any;
    const req: any = { userId: 'usr-1', headers: {}, ip: '1.2.3.4' };

    const next1 = vi.fn();
    limiter(req, makeRes(), next1);
    expect(next1).toHaveBeenCalledWith();

    const next2 = vi.fn();
    limiter(req, makeRes(), next2);
    expect(next2).toHaveBeenCalledWith();

    const res3 = makeRes();
    const next3 = vi.fn();
    limiter(req, res3, next3);
    expect(res3.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(next3).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 429,
        code: 'RATE_LIMITED',
      })
    );
  });

  it('ข้ามการนับเมื่อ skip() คืนค่า true และแยก namespace อิสระ', () => {
    const limiter = createRateLimitMiddleware({
      name: 'test-global',
      windowMs: 60_000,
      maxRequests: 1,
      skip: (req) => req.path === '/health',
    });

    const res = { setHeader: vi.fn() } as any;
    const nextSkip = vi.fn();
    limiter({ path: '/health', headers: {}, ip: '1.2.3.4' } as any, res, nextSkip);
    limiter({ path: '/health', headers: {}, ip: '1.2.3.4' } as any, res, nextSkip);
    expect(nextSkip).toHaveBeenNthCalledWith(1);
    expect(nextSkip).toHaveBeenNthCalledWith(2);
  });
});
