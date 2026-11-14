import { prisma as defaultPrisma } from '../config/prisma';
import {
  AppError,
  CreateReviewInput,
  ReviewItem,
  UserReviewsResult,
} from '../types';

/**
 * ส่งคะแนนและรีวิวคำสั่งซื้อ (POST /api/orders/:id/review)
 * - คำสั่งซื้อต้องอยู่ในสถานะ COMPLETED เท่านั้น
 * - ผู้ส่งรีวิวต้องเป็นผู้ซื้อ (buyer) หรือผู้ขาย (seller) ของออเดอร์นั้น
 * - ส่งได้ครั้งเดียวต่อหนึ่งออเดอร์ (One-time only)
 * - ผู้ซื้อบังคับระบุ is_condition_accurate (สภาพหนังสือตรงตามเกรดหรือไม่)
 */
export async function createOrderReview(
  orderId: string,
  reviewerId: string,
  input: CreateReviewInput,
  prismaClient?: any
) {
  const db = prismaClient || defaultPrisma;

  // 1. ตรวจสอบว่ามี Order อยู่จริง
  const order = await db.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('ไม่พบคำสั่งซื้อที่ระบุ', 404, 'ORDER_NOT_FOUND');
  }

  // 2. คำสั่งซื้อต้องอยู่ในสถานะ COMPLETED
  if (order.status !== 'COMPLETED') {
    throw new AppError(
      `สามารถรีวิวได้เฉพาะคำสั่งซื้อที่เสร็จสิ้นสมบูรณ์ (COMPLETED) เท่านั้น (สถานะปัจจุบัน: ${order.status})`,
      400,
      'INVALID_ORDER_STATUS'
    );
  }

  // 3. ตรวจสอบสิทธิ์ผู้รีวิว (ต้องเป็น buyer หรือ seller เท่านั้น)
  const isBuyer = order.buyerId === reviewerId;
  const isSeller = order.sellerId === reviewerId;

  if (!isBuyer && !isSeller) {
    throw new AppError('คุณไม่มีสิทธิ์ส่งรีวิวสำหรับคำสั่งซื้อนี้', 403, 'FORBIDDEN');
  }

  // 4. ตรวจสอบว่าเคยส่งรีวิวสำหรับออเดอร์นี้แล้วหรือยัง (One-time write)
  const existingReview = await db.review.findFirst({
    where: {
      orderId,
      reviewerId,
    },
  });

  if (existingReview) {
    throw new AppError('คุณได้ส่งรีวิวสำหรับคำสั่งซื้อนี้ไปแล้ว', 400, 'ALREADY_REVIEWED');
  }

  // 5. ตรวจสอบคะแนนดาว (1-5)
  const rating = Math.round(Number(input.rating));
  if (isNaN(rating) || rating < 1 || rating > 5) {
    throw new AppError('คะแนนรีวิวต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 5 ดาว', 400, 'INVALID_RATING');
  }

  // 6. ตรวจสอบ is_condition_accurate สำหรับผู้ซื้อ
  let isConditionAccurate: boolean | null = null;
  let revieweeId: string;

  if (isBuyer) {
    revieweeId = order.sellerId;
    if (typeof input.is_condition_accurate !== 'boolean') {
      throw new AppError(
        'กรุณาระบุว่าสภาพหนังสือตรงตามเกรดหรือไม่ (is_condition_accurate)',
        400,
        'CONDITION_ACCURACY_REQUIRED'
      );
    }
    isConditionAccurate = input.is_condition_accurate;
  } else {
    // ผู้ขายรีวิวผู้ซื้อ
    revieweeId = order.buyerId;
    isConditionAccurate = null;
  }

  // 7. บันทึกรีวิวลงฐานข้อมูล
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t).trim()).filter(Boolean)
    : [];

  const review = await db.review.create({
    data: {
      orderId,
      reviewerId,
      revieweeId,
      rating,
      isConditionAccurate,
      tags,
      comment: input.comment ? input.comment.trim() : null,
    },
  });

  return review;
}

/**
 * ดึงรายการรีวิวและคะแนนความน่าเชื่อถือของผู้ขาย (GET /api/users/:id/reviews)
 * คืน Trust Metrics: average_rating, condition_accuracy_rate, rating_breakdown, พร้อม Pagination
 */
export async function getUserReviews(
  userId: string,
  options?: { limit?: number; offset?: number },
  prismaClient?: any
): Promise<UserReviewsResult> {
  const db = prismaClient || defaultPrisma;

  // 1. ตรวจสอบว่ามีผู้ใช้อยู่จริง
  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError('ไม่พบข้อมูลผู้ใช้ในระบบ', 404, 'USER_NOT_FOUND');
  }

  // 2. ดึงรีวิวทั้งหมดของผู้ใช้รายนี้ (ในฐานะผู้ถูกรีวิว / reviewee)
  const allReviews = await db.review.findMany({
    where: { revieweeId: userId },
    include: {
      reviewer: {
        select: { id: true, nickname: true, avatarUrl: true },
      },
      order: {
        include: {
          orderItems: {
            include: {
              bookListing: {
                include: { bookCatalog: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalReviews = allReviews.length;

  // 3. คำนวณ Trust Metrics
  const breakdown: { 1: number; 2: number; 3: number; 4: number; 5: number } = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let totalRatingSum = 0;
  let totalAccurateCount = 0;
  let totalEvaluatedCondition = 0;

  for (const r of allReviews) {
    const star = Math.max(1, Math.min(5, r.rating)) as 1 | 2 | 3 | 4 | 5;
    breakdown[star]++;
    totalRatingSum += r.rating;

    if (r.isConditionAccurate !== null && r.isConditionAccurate !== undefined) {
      totalEvaluatedCondition++;
      if (r.isConditionAccurate) {
        totalAccurateCount++;
      }
    }
  }

  const averageRating =
    totalReviews > 0 ? Math.round((totalRatingSum / totalReviews) * 10) / 10 : 0;

  const conditionAccuracyRate =
    totalEvaluatedCondition > 0
      ? Math.round((totalAccurateCount / totalEvaluatedCondition) * 1000) / 10
      : null;

  // 4. Pagination
  const limit = Math.max(1, Math.min(50, options?.limit || 10));
  const offset = Math.max(0, options?.offset || 0);
  const paginatedReviews = allReviews.slice(offset, offset + limit);

  const mappedReviews: ReviewItem[] = paginatedReviews.map((r: any) => {
    const bookTitles =
      r.order?.orderItems
        ?.map((item: any) => item.bookListing?.bookCatalog?.title || 'หนังสือ')
        .filter(Boolean) || [];

    return {
      id: r.id,
      order_id: r.orderId,
      reviewer: {
        id: r.reviewer.id,
        nickname: r.reviewer.nickname,
        avatar_url: r.reviewer.avatarUrl,
      },
      rating: r.rating,
      is_condition_accurate: r.isConditionAccurate,
      tags: Array.isArray(r.tags) ? r.tags : [],
      comment: r.comment,
      book_titles: bookTitles,
      created_at: r.createdAt,
    };
  });

  return {
    summary: {
      average_rating: averageRating,
      total_reviews: totalReviews,
      condition_accuracy_rate: conditionAccuracyRate,
      rating_breakdown: breakdown,
    },
    reviews: mappedReviews,
    pagination: {
      total: totalReviews,
      limit,
      offset,
      has_more: offset + limit < totalReviews,
    },
  };
}
