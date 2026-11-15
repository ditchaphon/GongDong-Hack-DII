import { describe, it, expect, vi } from 'vitest';
import { checkIdCardWithBlacklistSeller } from '../blacklistService';

describe('blacklistService (Blacklistseller idcard-summary)', () => {
  it('คืนค่า found = true พร้อม freqCount และ totalPrice เมื่อพบประวัติ', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          query: { type: 'idcard', idcard: '1101700203450' },
          message: 'Data found for this ID card number.',
          result: {
            found: true,
            data: [{ idcard: '1101700203450', freq_count: 5, total_price: 2500.0 }],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const res = await checkIdCardWithBlacklistSeller('1-1017-00203-45-0', {
      apiKey: 'test-bls-key',
      apiUrl: 'https://api.blacklistseller.com/api/v1/queries/idcard-summary/',
      fetchFn: mockFetch,
    });

    expect(res).toEqual({
      found: true,
      freqCount: 5,
      totalPrice: 2500,
      message: 'Data found for this ID card number.',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.blacklistseller.com/api/v1/queries/idcard-summary/',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'test-bls-key',
        },
        body: JSON.stringify({ idcard: '1101700203450' }),
      })
    );
  });

  it('คืนค่า found = false เมื่อไม่พบประวัติใน Blacklistseller', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          result: { found: false, data: [] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const res = await checkIdCardWithBlacklistSeller('1101700203450', {
      apiKey: 'test-bls-key',
      fetchFn: mockFetch,
    });

    expect(res.found).toBe(false);
    expect(res.freqCount).toBe(0);
    expect(res.totalPrice).toBe(0);
  });

  it('โยน 503 เมื่อยังไม่ได้ตั้งค่า API Key และ 400 เมื่อเลขบัตรไม่ครบ 13 หลัก', async () => {
    await expect(
      checkIdCardWithBlacklistSeller('12345', { apiKey: 'test-key' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_NATIONAL_ID' });

    await expect(
      checkIdCardWithBlacklistSeller('1101700203450', { apiKey: '' })
    ).rejects.toMatchObject({ statusCode: 503, code: 'BLACKLIST_API_NOT_CONFIGURED' });
  });

  it('map สถานะ 401/403, 429 และ network error อย่างถูกต้อง', async () => {
    const authFailFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })) as unknown as typeof fetch;
    await expect(
      checkIdCardWithBlacklistSeller('1101700203450', { apiKey: 'bad', fetchFn: authFailFetch })
    ).rejects.toMatchObject({ statusCode: 502, code: 'BLACKLIST_API_AUTH_FAILED' });

    const rateLimitFetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 429 })) as unknown as typeof fetch;
    await expect(
      checkIdCardWithBlacklistSeller('1101700203450', { apiKey: 'ok', fetchFn: rateLimitFetch })
    ).rejects.toMatchObject({ statusCode: 503, code: 'BLACKLIST_API_RATE_LIMITED' });

    const networkErrFetch = vi
      .fn()
      .mockRejectedValue(new Error('ETIMEDOUT')) as unknown as typeof fetch;
    await expect(
      checkIdCardWithBlacklistSeller('1101700203450', { apiKey: 'ok', fetchFn: networkErrFetch })
    ).rejects.toMatchObject({ statusCode: 502, code: 'BLACKLIST_API_UNREACHABLE' });
  });
});
