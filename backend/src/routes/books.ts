import { Router, Request, Response, NextFunction } from 'express';
import {
  createBookListing,
  deleteBookListing,
  getBookListingDetail,
  getBookListings,
} from '../services/bookService';
import { getBookByIsbn } from '../services/googleBooksService';
import { AppError, BookGrade } from '../types';

export const bookRouter = Router();

function getUserIdFromRequest(req: Request): string {
  const userId =
    (req.headers['x-user-id'] as string) ||
    ((req as any).user?.id as string);

  if (!userId) {
    throw new AppError('กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized)', 401, 'UNAUTHORIZED');
  }

  return userId;
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
      const bookData = await getBookByIsbn(isbn);

      if (!bookData) {
        res.status(200).json({
          success: true,
          data: {
            found: false,
            isbn,
          },
          message: 'ไม่พบข้อมูลในแคตตาล็อกกลาง กรุณากรอกรายละเอียดด้วยตนเอง',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          found: true,
          isbn: bookData.isbn,
          title: bookData.title,
          author: bookData.author,
          publisher: bookData.publisher,
          category: bookData.category,
          cover_url: bookData.coverUrl,
          original_price: bookData.originalPrice,
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

      const result = await getBookListings({
        q: q ? String(q) : undefined,
        category: category ? String(category) : undefined,
        grade: grade ? (String(grade) as BookGrade) : undefined,
        shipping: shipping ? (String(shipping) as 'PICKUP' | 'DELIVERY') : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
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
 * DELETE /api/books/:id
 * ลบรายการลงขายหนังสือ (เฉพาะเล่มที่สถานะเป็น AVAILABLE และเป็นเจ้าของ)
 */
bookRouter.delete(
  '/:id',
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
