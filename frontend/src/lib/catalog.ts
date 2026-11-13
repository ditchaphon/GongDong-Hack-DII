/** Book categories used by the listing form and book detail page. */
export const BOOK_CATEGORIES = [
  'นิยาย',
  'วิชาการ',
  'การ์ตูน',
  'หนังสือเรียน',
  'วารสาร',
  'อื่น ๆ',
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];
