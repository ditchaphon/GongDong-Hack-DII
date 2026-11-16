import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  createBookListing,
  deleteBookListing,
  getBookIsbnComparison,
  getBookListingDetail,
  getBookListings,
  getPreviousListingsByIsbn,
  getRecommendedBooks,
  updateBookListing,
} from '../services/bookService';
import { lookupBookByIsbn } from '../services/googleBooksService';
import { AppError, BookGrade } from '../types';
import { getUserIdFromRequest } from '../utils/requestUser';

export const bookRouter = Router();

const VALID_GRADES = new Set<BookGrade>([
  'LIKE_NEW',
  'GENTLY_READ',
  'WELL_LOVED',
  'WORN_BUT_READABLE',
]);

function parsePaginationInt(raw: unknown, field: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const str = String(raw).trim();
  if (!/^\d+$/.test(str)) {
    throw new AppError(
      `พารามิเตอร์ ${field} ต้องเป็นจำนวนเต็มที่ไม่ติดลบ`,
      400,
      'INVALID_PAGINATION'
    );
  }
  return Number(str);
}

/**
 * GET /api/books/isbn/:isbn
 * ดึงข้อมูลหนังสืออัตโนมัติจากรหัส ISBN (Google Books API / Cache)
 */
bookRouter.get(
  '/isbn/:isbn',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isbn = String(req.params.isbn);
      const [result, previousListings] = await Promise.all([
        lookupBookByIsbn(isbn),
        getPreviousListingsByIsbn(isbn, 5).catch(() => []),
      ]);

      const firstListing = previousListings[0];

      if (!result.found || !result.book) {
        if (firstListing) {
          res.status(200).json({
            success: true,
            data: {
              found: true,
              source: 'DATABASE',
              warning_code: null,
              warning_message: null,
              isbn: firstListing.isbn,
              title: firstListing.title,
              author: firstListing.author,
              publisher: firstListing.publisher,
              category: firstListing.category,
              cover_url: firstListing.cover_image_url,
              original_price: firstListing.original_price,
              previous_listings: previousListings,
            },
          });
          return;
        }

        const message =
          result.warningCode === 'GOOGLE_BOOKS_RATE_LIMITED'
            ? 'Google Books API ถูกจำกัดการใช้งานชั่วคราว (HTTP 429) และไม่พบในแหล่งสำรอง กรุณากรอกรายละเอียดด้วยตนเอง'
            : result.warningCode === 'EXTERNAL_LOOKUP_FAILED'
              ? 'ไม่สามารถดึงข้อมูลจากบริการภายนอกได้ชั่วคราว กรุณากรอกรายละเอียดด้วยตนเอง'
              : 'ไม่พบข้อมูลทั้งใน Database และ Google Books / Open Library กรุณากรอกรายละเอียดด้วยตนเอง';

        res.status(200).json({
          success: true,
          data: {
            found: false,
            isbn: result.isbn,
            source: null,
            warning_code: result.warningCode || null,
            warning_message: result.warningMessage || null,
            previous_listings: [],
          },
          message,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          found: true,
          source: result.source,
          warning_code: result.warningCode || null,
          warning_message: result.warningMessage || null,
          isbn: result.book.isbn,
          title: result.book.title || firstListing?.title || '',
          author: result.book.author || firstListing?.author || null,
          publisher: result.book.publisher || firstListing?.publisher || null,
          category: result.book.category || firstListing?.category || null,
          cover_url: result.book.coverUrl || firstListing?.cover_image_url || null,
          original_price:
            result.book.originalPrice !== null &&
            result.book.originalPrice !== undefined &&
            Number(result.book.originalPrice) > 0
              ? result.book.originalPrice
              : firstListing?.original_price ?? null,
          previous_listings: previousListings,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/books
 * ค้นหาและกรองรายการหนังสือในตลาด (หน้าจอ B1)
 */
bookRouter.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, category, grade, shipping, limit, offset } = req.query;

      const gradeStr = grade ? String(grade) : undefined;
      if (gradeStr && !VALID_GRADES.has(gradeStr as BookGrade)) {
        throw new AppError('ค่าเกรดหนังสือไม่ถูกต้อง', 400, 'INVALID_FILTER');
      }

      const shippingStr = shipping ? String(shipping) : undefined;
      if (shippingStr && shippingStr !== 'PICKUP' && shippingStr !== 'DELIVERY') {
        throw new AppError('รูปแบบการจัดส่งไม่ถูกต้อง (PICKUP หรือ DELIVERY)', 400, 'INVALID_FILTER');
      }

      const result = await getBookListings({
        q: q ? String(q) : undefined,
        category: category ? String(category) : undefined,
        grade: gradeStr as BookGrade | undefined,
        shipping: shippingStr as 'PICKUP' | 'DELIVERY' | undefined,
        limit: parsePaginationInt(limit, 'limit'),
        offset: parsePaginationInt(offset, 'offset'),
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/books/recommended
 * ดึงรายการหนังสือแนะนำบนหน้าแรก (ต้องอยู่ก่อน /:id)
 */
bookRouter.get(
  '/recommended',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parsePaginationInt(req.query.limit, 'limit') ?? 8;
      const result = await getRecommendedBooks(limit);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/books/:id/compare
 * เปรียบเทียบหนังสือ ISBN เดียวกันจากร้านอื่นที่ยังพร้อมขาย (ISBN Smart Compare)
 */
bookRouter.get(
  '/:id/compare',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const result = await getBookIsbnComparison(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/books/:id
 * ดูรายละเอียดหนังสือรายเล่ม (หน้าจอ B2)
 */
bookRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const bookDetail = await getBookListingDetail(id);

      res.status(200).json({
        success: true,
        data: bookDetail,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/books
 * ลงขายหนังสือเล่มใหม่ (หน้าจอ S2)
 */
bookRouter.post(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sellerId = getUserIdFromRequest(req);
      const result = await createBookListing(sellerId, req.body);

      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          title: result.title,
          category: result.category,
          categories: result.categories,
          is_set: result.isSet,
          grade: result.grade,
          price: result.price,
          recommended_price: result.recommendedPrice,
          status: result.status,
          created_at: result.createdAt,
        },
        message: 'ลงขายหนังสือสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/books/:id
 * แก้ไขราคา รายละเอียด หรือซ่อนประกาศขายหนังสือ (HIDDEN)
 */
bookRouter.patch(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sellerId = getUserIdFromRequest(req);
      const id = String(req.params.id);
      const result = await updateBookListing(id, sellerId, req.body);

      res.status(200).json({
        success: true,
        data: result,
        message: 'อัปเดตรายการหนังสือสำเร็จ',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/books/:id
 * ลบรายการลงขายหนังสือ (เฉพาะเล่มที่สถานะเป็น AVAILABLE หรือ HIDDEN และเป็นเจ้าของ)
 */
bookRouter.delete(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sellerId = getUserIdFromRequest(req);
      const id = String(req.params.id);

      const result = await deleteBookListing(id, sellerId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
);
