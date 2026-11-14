import { describe, expect, it, vi } from 'vitest';
import { getOrderMessages, sendOrderMessage } from '../messageService';

describe('messageService (In-Order Chat & PDPA Masking)', () => {
  it('คืนรายการว่างเมื่อออเดอร์ยังอยู่ในสถานะ REQUESTED', async () => {
    const mockPrisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'REQUESTED',
        }),
      },
    };

    const msgs = await getOrderMessages('ord-1', 'buyer-1', mockPrisma);
    expect(msgs).toEqual([]);
  });

  it('ไม่อนุญาตให้ส่งข้อความในสถานะ REQUESTED และ COMPLETED', async () => {
    const mockRequested = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'REQUESTED',
        }),
      },
    };
    await expect(
      sendOrderMessage('ord-1', 'buyer-1', { text: 'สวัสดี' }, mockRequested)
    ).rejects.toMatchObject({ statusCode: 400, code: 'CHAT_NOT_OPEN' });

    const mockCompleted = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'COMPLETED',
        }),
      },
    };
    await expect(
      sendOrderMessage('ord-1', 'buyer-1', { text: 'ขอบคุณ' }, mockCompleted)
    ).rejects.toMatchObject({ statusCode: 400, code: 'CHAT_READ_ONLY' });
  });

  it('เซ็นเซอร์เบอร์โทรในแชทอัตโนมัติและบันทึก isMasked = true', async () => {
    const mockPrisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ord-1',
          buyerId: 'buyer-1',
          sellerId: 'seller-1',
          status: 'ACCEPTED',
        }),
      },
      orderMessage: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: 'msg-1',
          ...data,
          createdAt: new Date(),
          sender: { id: 'buyer-1', nickname: 'กานต์', avatarUrl: null },
        })),
      },
    };

    const msg = await sendOrderMessage(
      'ord-1',
      'buyer-1',
      { text: 'โทรหาผมได้ที่ 0812345678 นะครับ' },
      mockPrisma
    );

    expect(msg.senderRole).toBe('BUYER');
    expect(msg.isMasked).toBe(true);
    expect(msg.text).not.toContain('0812345678');
    expect(msg.text).toContain('•••');
  });
});
