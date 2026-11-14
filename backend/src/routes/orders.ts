import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { maskAccountHolderName } from '../services/dataMaskingService';
import { getOrderMessages, sendOrderMessage } from '../services/messageService';
import {
  acceptOrder,
  cancelOrder,
  completeDeliveryOrder,
  completeMeetupCodOrder,
  createBatchOrders,
  createOrder,
  disputeMissedMeeting,
  getOrderDetail,
  getOrderPaymentQR,
  getUserOrders,
  openDispute,
  receiveOrder,
  rejectOrder,
  reportMissedMeeting,
  schedulePickupOrder,
  shipOrder,
  verifyHandoverCode,
  verifyOrderPaymentSlip,
} from '../services/orderService';
import { createOrderReview } from '../services/reviewService';
import { AppError, CreateOrderInput, CreateOrderResult } from '../types';
import { getUserIdFromRequest } from '../utils/requestUser';

export const orderRouter = Router();

orderRouter.use(authMiddleware);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCreateOrderBody(raw: Record<string, any>): CreateOrderInput {
  const sellerId = raw?.seller_id ?? raw?.sellerId;
  const bookIds = raw?.book_ids ?? raw?.bookIds;
  const shippingMethod = raw?.shipping_method ?? raw?.shippingMethod;

  if (!sellerId || !bookIds || !shippingMethod) {
    throw new AppError('ข้อมูลคำสั่งซื้อไม่ครบถ้วน', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (typeof sellerId !== 'string' || !UUID_REGEX.test(sellerId)) {
    throw new AppError('รหัสร้านค้าไม่ถูกต้อง', 400, 'INVALID_SELLER_ID');
  }

  if (!Array.isArray(bookIds) || bookIds.length === 0) {
    throw new AppError('กรุณาเลือกหนังสืออย่างน้อย 1 เล่ม', 400, 'EMPTY_CART', { sellerId });
  }

  const invalidIds = bookIds.filter((id) => typeof id !== 'string' || !UUID_REGEX.test(id));
  if (invalidIds.length > 0) {
    throw new AppError('รหัสหนังสือไม่ถูกต้อง', 400, 'INVALID_BOOK_ID', {
      sellerId,
      invalidBookIds: invalidIds,
    });
  }

  const expectedTotalRaw = raw.expected_total ?? raw.expectedTotal;
  const expectedTotal =
    expectedTotalRaw !== undefined && expectedTotalRaw !== null
      ? Number(expectedTotalRaw)
      : undefined;

  return {
    sellerId,
    bookIds,
    shippingMethod,
    paymentMethod: raw.payment_method || raw.paymentMethod,
    recipientName: raw.recipient_name || raw.recipientName,
    recipientPhone: raw.recipient_phone ?? raw.recipientPhone,
    buyerProvince: raw.buyer_province || raw.buyerProvince,
    deliveryAddress: raw.delivery_address || raw.deliveryAddress,
    pickupLat: raw.pickup_lat !== undefined ? Number(raw.pickup_lat) : undefined,
    pickupLng: raw.pickup_lng !== undefined ? Number(raw.pickup_lng) : undefined,
    pickupLocationName: raw.pickup_location_name || raw.pickupLocationName,
    scheduledAt: raw.scheduled_at || raw.scheduledAt,
    scheduleDateIso: raw.schedule_date_iso || raw.scheduleDateIso,
    scheduleTimeLabel: raw.schedule_time_label || raw.scheduleTimeLabel,
    shipWithinDays:
      raw.ship_within_days !== undefined ? Number(raw.ship_within_days) : undefined,
    expectedTotal:
      expectedTotal !== undefined && Number.isFinite(expectedTotal) ? expectedTotal : undefined,
    idempotencyKey: raw.idempotency_key || raw.idempotencyKey,
  };
}

function serializeCreateOrderResult(result: CreateOrderResult) {
  return {
    order_id: result.orderId,
    total_price: result.totalPrice,
    shipping_fee: result.shippingFee,
    payment_method: result.paymentMethod,
    status: result.status,
    created_at: result.createdAt,
  };
}

/**
 * POST /api/orders
 * ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (หน้าจอ B3)
 */
orderRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buyerId = getUserIdFromRequest(req);
      const parsed = parseCreateOrderBody(req.body);
      const result = await createOrder(buyerId, parsed);

      res.status(201).json({
        success: true,
        data: serializeCreateOrderResult(result),
        message: 'ส่งคำขอซื้อสำเร็จ แจ้งเตือนไปยังร้านค้าแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/batch
 * ผู้ซื้อส่งคำขอซื้อหลายร้านค้าพร้อมกันแบบ All-or-Nothing
 */
orderRouter.post(
  '/batch',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buyerId = getUserIdFromRequest(req);
      const rawOrders = req.body?.orders;
      if (!Array.isArray(rawOrders) || rawOrders.length === 0) {
        throw new AppError(
          'กรุณาระบุรายการคำสั่งซื้ออย่างน้อย 1 ร้านค้า',
          400,
          'MISSING_REQUIRED_FIELDS'
        );
      }

      const parsedOrders = rawOrders.map((entry: Record<string, any>) =>
        parseCreateOrderBody(entry)
      );
      const idempotencyKey = req.body?.idempotency_key || req.body?.idempotencyKey;

      const result = await createBatchOrders(buyerId, {
        orders: parsedOrders,
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          orders: result.orders.map(serializeCreateOrderResult),
        },
        message: `ส่งคำขอซื้อสำเร็จ ${result.orders.length} ร้านค้า แจ้งเตือนไปยังร้านค้าแล้ว`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/buying
 * รายการคำสั่งซื้อที่ตนเองสั่งซื้อ
 */
orderRouter.get(
  '/buying',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const result = await getUserOrders(userId, 'buying');

      res.status(200).json({
        success: true,
        data: {
          orders: result.buying || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/selling
 * รายการคำสั่งซื้อที่เข้ามายังร้านค้าของตนเอง
 */
orderRouter.get(
  '/selling',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserIdFromRequest(req);
      const result = await getUserOrders(userId, 'selling');

      res.status(200).json({
        success: true,
        data: {
          orders: result.selling || [],
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

orderRouter.param('id', (_req: Request, _res: Response, next: NextFunction, id: string) => {
  if (!UUID_REGEX.test(String(id || ''))) {
    next(new AppError('รหัสคำสั่งซื้อไม่ถูกต้อง', 400, 'INVALID_ORDER_ID'));
    return;
  }
  next();
});

/**
 * GET /api/orders/:id
 * ดูรายละเอียดคำสั่งซื้อ (หน้าจอ B5 สำหรับผู้ซื้อ / S4 สำหรับผู้ขาย) พร้อม PDPA
 */
orderRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);

      const orderDetail = await getOrderDetail(orderId, userId);

      res.status(200).json({
        success: true,
        data: {
          id: orderDetail.id,
          status: orderDetail.status,
          shipping_method: orderDetail.shippingMethod,
          payment_method: orderDetail.paymentMethod,
          shipping_fee: orderDetail.shippingFee,
          total_price: orderDetail.totalPrice,
          pickup_lat: orderDetail.pickupLat,
          pickup_lng: orderDetail.pickupLng,
          pickup_location_name: orderDetail.pickupLocationName,
          scheduled_at: orderDetail.scheduledAt,
          schedule_date_iso: orderDetail.scheduleDateIso,
          schedule_time_label: orderDetail.scheduleTimeLabel,
          schedule_proposed_by: orderDetail.scheduleProposedBy,
          schedule_confirmed_by_buyer: orderDetail.scheduleConfirmedByBuyer,
          handover_code: orderDetail.handoverCode ?? null,
          received_photo_url: orderDetail.receivedPhotoUrl,
          received_at: orderDetail.receivedAt,
          cancel_reason: orderDetail.cancelReason,
          missed_meeting_reported_at: orderDetail.missedMeetingReportedAt ?? null,
          review: orderDetail.review
            ? {
                rating: orderDetail.review.rating,
                is_condition_accurate: orderDetail.review.isConditionAccurate,
                tags: orderDetail.review.tags,
                comment: orderDetail.review.comment,
                created_at: orderDetail.review.createdAt,
              }
            : null,
          dispute: orderDetail.dispute
            ? {
                reason: orderDetail.dispute.reason,
                opened_by: orderDetail.dispute.openedBy,
                opened_at: orderDetail.dispute.openedAt,
              }
            : null,
          items: orderDetail.items.map((item) => ({
            book_id: item.bookId,
            title: item.title,
            price: item.price,
            cover_image_url: item.coverImageUrl,
            grade: item.grade,
          })),
          buyer: {
            id: orderDetail.buyer.id,
            nickname: orderDetail.buyer.nickname,
            avatar_url: orderDetail.buyer.avatarUrl,
            phone_number: orderDetail.buyer.phoneNumber ?? null,
            no_show_count: orderDetail.buyer.noShowCount ?? 0,
          },
          seller: {
            id: orderDetail.seller.id,
            nickname: orderDetail.seller.nickname,
            shop_name: orderDetail.seller.shopName,
            avatar_url: orderDetail.seller.avatarUrl,
            verified_name: maskAccountHolderName(orderDetail.seller.verifiedName),
            is_verified_seller: orderDetail.seller.isVerifiedSeller,
          },
          delivery_details: orderDetail.deliveryDetails
            ? {
                recipient_name: orderDetail.deliveryDetails.recipientName,
                recipient_phone: orderDetail.deliveryDetails.recipientPhone,
                province: orderDetail.deliveryDetails.province,
                delivery_address: orderDetail.deliveryDetails.deliveryAddress,
                courier_name: orderDetail.deliveryDetails.courierName,
                tracking_number: orderDetail.deliveryDetails.trackingNumber,
                parcel_image_url: orderDetail.deliveryDetails.parcelImageUrl,
                shipped_at: orderDetail.deliveryDetails.shippedAt,
              }
            : null,
          payment_slip_url: orderDetail.paymentSlipUrl ?? null,
          created_at: orderDetail.createdAt,
          updated_at: orderDetail.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/accept
 * ผู้ขายกดรับออเดอร์
 */
orderRouter.post(
  '/:id/accept',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const sellerId = getUserIdFromRequest(req);

      const result = await acceptOrder(orderId, sellerId);

      res.status(200).json({
        success: true,
        data: {
          order_id: result.orderId,
          status: result.status,
          remaining_credits: result.remainingCredits,
        },
        message: 'รับออเดอร์สำเร็จ หัก 1 เครดิต และล็อกสต็อกหนังสือให้คำสั่งซื้อนี้แล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/reject
 * ผู้ขายปฏิเสธคำขอซื้อ
 */
orderRouter.post(
  '/:id/reject',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const sellerId = getUserIdFromRequest(req);

      const result = await rejectOrder(orderId, sellerId);

      res.status(200).json({
        success: true,
        data: {
          order_id: result.orderId,
          status: result.status,
        },
        message: 'ปฏิเสธคำขอซื้อเรียบร้อย ไม่เสียเครดิต',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/orders/:id/schedule
 * ยืนยันวันเวลานัดหมายและพิกัดนัดพบ
 */
orderRouter.patch(
  '/:id/schedule',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);
      const {
        scheduled_at,
        schedule_date_iso,
        schedule_time_label,
        pickup_lat,
        pickup_lng,
        pickup_location_name,
      } = req.body;

      if (!scheduled_at) {
        throw new AppError('กรุณาระบุวันเวลานัดหมาย (scheduled_at)', 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (pickup_lat === undefined || pickup_lng === undefined) {
        throw new AppError('กรุณาระบุพิกัดละติจูดและลองจิจูดจุดนัดรับ', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const result = await schedulePickupOrder(orderId, userId, {
        scheduledAt: scheduled_at,
        scheduleDateIso: schedule_date_iso || req.body.scheduleDateIso,
        scheduleTimeLabel: schedule_time_label || req.body.scheduleTimeLabel,
        pickupLat: Number(pickup_lat),
        pickupLng: Number(pickup_lng),
        pickupLocationName: pickup_location_name,
      });

      res.status(200).json({
        success: true,
        data: {
          status: result.status,
          scheduled_at: result.scheduledAt.toISOString(),
          handover_code: result.handoverCode,
        },
        message: 'ยืนยันการนัดหมายสำเร็จ รหัสส่งมอบ 6 หลักถูกสร้างให้ผู้ซื้อแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/handover
 * ผู้ขายกรอกรหัสส่งมอบ 6 หลักเพื่อปิดการขาย
 */
orderRouter.post(
  '/:id/handover',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const sellerId = getUserIdFromRequest(req);
      const { handover_code } = req.body;

      if (!handover_code) {
        throw new AppError('กรุณาระบุรหัสส่งมอบ 6 หลัก (handover_code)', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const result = await verifyHandoverCode(orderId, sellerId, handover_code);

      res.status(200).json({
        success: true,
        data: {
          status: result.status,
          sold_book_ids: result.soldBookIds,
        },
        message: 'ส่งมอบหนังสือสำเร็จ ปิดการขายเรียบร้อย',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/:id/payment-qr
 * สร้าง PromptPay QR สำหรับผู้ซื้อชำระเงินค่าหนังสือ (เฉพาะ DELIVERY + TRANSFER + สถานะ ACCEPTED)
 */
orderRouter.get(
  '/:id/payment-qr',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const buyerId = getUserIdFromRequest(req);

      const qr = await getOrderPaymentQR(orderId, buyerId);

      res.status(200).json({
        success: true,
        data: {
          order_id: qr.orderId,
          amount: qr.amount,
          recipient_label: qr.recipientLabel,
          qr_data_url: qr.qrDataUrl,
          payload: qr.payload,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/payment-slip
 * ผู้ซื้อแนบสลิปชำระเงินค่าหนังสือ (โหมดพัสดุ)
 */
orderRouter.post(
  '/:id/payment-slip',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const buyerId = getUserIdFromRequest(req);
      const { slip_image_url, storage_path, trans_ref, amount, receiver_name } = req.body;

      const result = await verifyOrderPaymentSlip(orderId, buyerId, {
        slipImageUrl: slip_image_url,
        storagePath: storage_path,
        transRef: trans_ref,
        amount: amount ? Number(amount) : undefined,
        receiverName: receiver_name,
      });

      res.status(200).json({
        success: true,
        data: {
          status: result.status,
          verification_status: result.verificationStatus,
          trans_ref: result.transRef,
        },
        message: 'ตรวจสอบสลิปโอนเงินสำเร็จ สถานะออเดอร์เปลี่ยนเป็น PAID แล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/ship & PATCH /api/orders/:id/ship
 * ผู้ขายบันทึกข้อมูลจัดส่งพัสดุ (ชื่อขนส่ง + เลขพัสดุ + รูปกล่อง)
 */
async function handleShipOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = String(req.params.id);
    const sellerId = getUserIdFromRequest(req);
    const { courier_name, tracking_number, parcel_image_url } = req.body;

    const result = await shipOrder(orderId, sellerId, {
      courierName: courier_name,
      trackingNumber: tracking_number,
      parcelImageUrl: parcel_image_url,
    });

    res.status(200).json({
      success: true,
      data: {
        status: result.status,
        tracking_number: result.trackingNumber,
      },
      message: 'บันทึกข้อมูลจัดส่งสำเร็จ แจ้งเลขพัสดุให้ผู้ซื้อผ่าน LINE เรียบร้อย',
    });
  } catch (error) {
    next(error);
  }
}
orderRouter.post('/:id/ship', handleShipOrder);
orderRouter.patch('/:id/ship', handleShipOrder);

/**
 * POST /api/orders/:id/complete-delivery & POST /api/orders/:id/confirm-receipt
 * ผู้ซื้อกดยืนยันได้รับสินค้าแล้ว
 */
async function handleCompleteDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = String(req.params.id);
    const buyerId = getUserIdFromRequest(req);

    const result = await completeDeliveryOrder(orderId, buyerId);

    res.status(200).json({
      success: true,
      data: {
        status: result.status,
      },
      message: 'ยืนยันรับสินค้าเรียบร้อย คำสั่งซื้อเสร็จสิ้นสมบูรณ์',
    });
  } catch (error) {
    next(error);
  }
}
orderRouter.post('/:id/complete-delivery', handleCompleteDelivery);
orderRouter.post('/:id/confirm-receipt', handleCompleteDelivery);

/**
 * POST /api/orders/:id/report-missed-meeting & POST /api/orders/:id/missed-meeting
 * ผู้ขายกดรายงานว่าผู้ซื้อไม่มาตามนัด (นัดรับ)
 */
async function handleMissedMeeting(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = String(req.params.id);
    const sellerId = getUserIdFromRequest(req);
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
        ? req.body.reason.trim()
        : undefined;

    const result = await reportMissedMeeting(orderId, sellerId, reason);

    res.status(200).json({
      success: true,
      data: {
        missed_meeting_reported_at: result.missedMeetingReportedAt.toISOString(),
      },
      message: 'บันทึกรายงานเรียบร้อย ระบบให้สิทธิ์ผู้ซื้อโต้แย้งภายใน 24 ชม.',
    });
  } catch (error) {
    next(error);
  }
}
orderRouter.post('/:id/report-missed-meeting', handleMissedMeeting);
orderRouter.post('/:id/missed-meeting', handleMissedMeeting);

/**
 * POST /api/orders/:id/review
 * ผู้ซื้อ/ผู้ขายเขียนรีวิวและให้คะแนน 1–5 ดาวหลังจบออเดอร์ (COMPLETED)
 */
orderRouter.post(
  '/:id/review',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const reviewerId = getUserIdFromRequest(req);

      await createOrderReview(orderId, reviewerId, req.body);

      res.status(200).json({
        success: true,
        message: 'บันทึกรีวิวสำเร็จ ขอบคุณสำหรับข้อเสนอแนะ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/cancel
 * ผู้ซื้อหรือผู้ขายยกเลิกคำสั่งซื้อ
 */
orderRouter.post(
  '/:id/cancel',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);
      const reason = String(req.body?.reason || req.body?.cancelReason || '');

      const result = await cancelOrder(orderId, userId, reason);
      res.status(200).json({
        success: true,
        data: result,
        message: 'ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/receive
 * ผู้ซื้อถ่ายรูปยืนยันรับหนังสือพร้อมรีวิว (v4 Flow)
 */
orderRouter.post(
  '/:id/receive',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const buyerId = getUserIdFromRequest(req);
      const receivedPhotoUrl = String(
        req.body?.received_photo_url || req.body?.receivedPhotoUrl || ''
      );

      const rawReview = req.body?.review;
      const review = rawReview
        ? {
            rating: Number(rawReview.rating),
            isConditionAccurate: Boolean(
              rawReview.isConditionAccurate ?? rawReview.is_condition_accurate ?? true
            ),
            tags: Array.isArray(rawReview.tags) ? rawReview.tags : [],
            comment: rawReview.comment,
          }
        : undefined;

      const result = await receiveOrder(orderId, buyerId, {
        receivedPhotoUrl,
        review,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'ยืนยันได้รับหนังสือเรียบร้อยแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/complete-meetup
 * ผู้ขายกดยืนยันส่งมอบนัดรับสำเร็จ (โหมด COD / นัดรับ)
 */
orderRouter.post(
  '/:id/complete-meetup',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const sellerId = getUserIdFromRequest(req);

      const result = await completeMeetupCodOrder(orderId, sellerId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'ยืนยันการส่งมอบนัดรับสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/dispute
 * เปิดข้อพิพาทคำสั่งซื้อ
 */
orderRouter.post(
  '/:id/dispute',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);
      const reason = String(req.body?.reason || '');

      const result = await openDispute(orderId, userId, reason);
      res.status(200).json({
        success: true,
        data: result,
        message: 'เปิดข้อพิพาทคำสั่งซื้อแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/dispute-missed-meeting
 * ผู้ซื้อโต้แย้งกรณีถูกรายงานไม่มาตามนัด
 */
orderRouter.post(
  '/:id/dispute-missed-meeting',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const buyerId = getUserIdFromRequest(req);
      const reason = String(req.body?.reason || '');

      const result = await disputeMissedMeeting(orderId, buyerId, reason);
      res.status(200).json({
        success: true,
        data: result,
        message: 'บันทึกคำโต้แย้งเรียบร้อยแล้ว',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/:id/messages
 * ดึงประวัติข้อความแชทในคำสั่งซื้อ
 */
orderRouter.get(
  '/:id/messages',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);

      const messages = await getOrderMessages(orderId, userId);
      res.status(200).json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/messages
 * ส่งข้อความแชทในคำสั่งซื้อ (PDPA Masking อัตโนมัติ)
 */
orderRouter.post(
  '/:id/messages',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const userId = getUserIdFromRequest(req);

      const message = await sendOrderMessage(orderId, userId, {
        text: String(req.body?.text || ''),
        kind: req.body?.kind,
      });

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }
);
