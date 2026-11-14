import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { getOrderMessages, sendOrderMessage } from '../services/messageService';
import {
  acceptOrder,
  cancelOrder,
  completeDeliveryOrder,
  completeMeetupCodOrder,
  createOrder,
  disputeMissedMeeting,
  getOrderDetail,
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
import { AppError } from '../types';
import { getUserIdFromRequest } from '../utils/requestUser';

export const orderRouter = Router();

orderRouter.use(authMiddleware);

/**
 * POST /api/orders
 * ผู้ซื้อส่งคำขอซื้อสินค้าจากตะกร้า (หน้าจอ B3)
 */
orderRouter.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buyerId = getUserIdFromRequest(req);
      const {
        seller_id,
        book_ids,
        shipping_method,
        payment_method,
        recipient_name,
        recipient_phone,
        buyer_province,
        delivery_address,
        pickup_lat,
        pickup_lng,
        pickup_location_name,
        scheduled_at,
        schedule_date_iso,
        schedule_time_label,
        ship_within_days,
      } = req.body;

      if (!seller_id || !book_ids || !shipping_method) {
        throw new AppError('ข้อมูลคำสั่งซื้อไม่ครบถ้วน', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const result = await createOrder(buyerId, {
        sellerId: seller_id,
        bookIds: book_ids,
        shippingMethod: shipping_method,
        paymentMethod: payment_method || req.body.paymentMethod,
        recipientName: recipient_name || req.body.recipientName,
        recipientPhone: recipient_phone ?? req.body.recipientPhone,
        buyerProvince: buyer_province || req.body.buyerProvince,
        deliveryAddress: delivery_address || req.body.deliveryAddress,
        pickupLat: pickup_lat !== undefined ? Number(pickup_lat) : undefined,
        pickupLng: pickup_lng !== undefined ? Number(pickup_lng) : undefined,
        pickupLocationName: pickup_location_name || req.body.pickupLocationName,
        scheduledAt: scheduled_at || req.body.scheduledAt,
        scheduleDateIso: schedule_date_iso || req.body.scheduleDateIso,
        scheduleTimeLabel: schedule_time_label || req.body.scheduleTimeLabel,
        shipWithinDays:
          ship_within_days !== undefined ? Number(ship_within_days) : undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          order_id: result.orderId,
          total_price: result.totalPrice,
          shipping_fee: result.shippingFee,
          payment_method: result.paymentMethod,
          status: result.status,
          created_at: result.createdAt,
        },
        message: 'ส่งคำขอซื้อสำเร็จ แจ้งเตือนไปยังร้านค้าแล้ว',
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
          shipping_fee: orderDetail.shippingFee,
          total_price: orderDetail.totalPrice,
          pickup_lat: orderDetail.pickupLat,
          pickup_lng: orderDetail.pickupLng,
          pickup_location_name: orderDetail.pickupLocationName,
          scheduled_at: orderDetail.scheduledAt,
          handover_code: orderDetail.handoverCode,
          items: orderDetail.items.map((item) => ({
            book_id: item.bookId,
            title: item.title,
            price: item.price,
            cover_image_url: item.coverImageUrl,
          })),
          buyer: {
            id: orderDetail.buyer.id,
            nickname: orderDetail.buyer.nickname,
            avatar_url: orderDetail.buyer.avatarUrl,
            phone_number: orderDetail.buyer.phoneNumber,
          },
          seller: {
            id: orderDetail.seller.id,
            nickname: orderDetail.seller.nickname,
            avatar_url: orderDetail.seller.avatarUrl,
            promptpay_id: orderDetail.seller.promptpayId,
            verified_name: orderDetail.seller.verifiedName,
            is_verified_seller: orderDetail.seller.isVerifiedSeller,
          },
          delivery_details: orderDetail.deliveryDetails
            ? {
                recipient_name: orderDetail.deliveryDetails.recipientName,
                recipient_phone: orderDetail.deliveryDetails.recipientPhone,
                delivery_address: orderDetail.deliveryDetails.deliveryAddress,
                courier_name: orderDetail.deliveryDetails.courierName,
                tracking_number: orderDetail.deliveryDetails.trackingNumber,
                parcel_image_url: orderDetail.deliveryDetails.parcelImageUrl,
                shipped_at: orderDetail.deliveryDetails.shippedAt,
              }
            : null,
          created_at: orderDetail.createdAt,
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
      const { scheduled_at, pickup_lat, pickup_lng, pickup_location_name } = req.body;

      if (!scheduled_at) {
        throw new AppError('กรุณาระบุวันเวลานัดหมาย (scheduled_at)', 400, 'MISSING_REQUIRED_FIELDS');
      }

      if (pickup_lat === undefined || pickup_lng === undefined) {
        throw new AppError('กรุณาระบุพิกัดละติจูดและลองจิจูดจุดนัดรับ', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const result = await schedulePickupOrder(orderId, userId, {
        scheduledAt: scheduled_at,
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
 * POST /api/orders/:id/payment-slip
 * ผู้ซื้อแนบสลิปชำระเงินค่าหนังสือ (โหมดพัสดุ)
 */
orderRouter.post(
  '/:id/payment-slip',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderId = String(req.params.id);
      const buyerId = getUserIdFromRequest(req);
      const { slip_image_url, trans_ref, amount, receiver_name } = req.body;

      const result = await verifyOrderPaymentSlip(orderId, buyerId, {
        slipImageUrl: slip_image_url,
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

    const result = await reportMissedMeeting(orderId, sellerId);

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
