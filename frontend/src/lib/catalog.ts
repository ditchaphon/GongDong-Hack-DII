import type { BookGrade, ConditionChecklist, CreditPackage } from '@/types';
import type { V4Grade } from '@/types/v4';

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

const CATEGORY_MATCHERS: Array<{ category: Exclude<BookCategory, 'อื่น ๆ'>; pattern: RegExp }> = [
  {
    category: 'การ์ตูน',
    pattern: /comic|manga|graphic\s*novel|การ์ตูน|มังงะ/i,
  },
  {
    category: 'หนังสือเรียน',
    pattern: /textbook|study\s*aid|education|workbook|exam|course|หนังสือเรียน|แบบฝึกหัด|คู่มือสอบ/i,
  },
  {
    category: 'นิยาย',
    pattern:
      /(?<!non[\s-])fiction|novel|literature|fantasy|romance|mystery|thriller|horror|sci-fi|light\s*novel|นิยาย|วรรณกรรม|เรื่องสั้น/i,
  },
  {
    category: 'วารสาร',
    pattern: /periodical|magazine|journal|newspaper|วารสาร|นิตยสาร/i,
  },
  {
    category: 'วิชาการ',
    pattern:
      /non[\s-]?fiction|computer|science|math|engineering|medical|medicine|business|economic|law|history|psychology|philosophy|academic|technology|architecture|social\s*science|programming|software|reference|วิชาการ|วิทยาศาสตร์|คอมพิวเตอร์|จิตวิทยา|พัฒนาตนเอง|บริหาร|ประวัติศาสตร์/i,
  },
];

/**
 * แปลงชื่อหมวดหมู่จาก API/Database (มักเป็นภาษาอังกฤษ เช่น "Fiction", "Computers")
 * เข้ากับ 6 หมวดหมู่ภาษาไทยของแพลตฟอร์ม
 * - ถ้า API ไม่ส่งหมวดหมู่มาเลย -> คืน [] ให้ผู้ขายเลือกเอง
 * - ถ้า API ส่งมาแต่ไม่เข้า 5 หมวดหลัก -> คืน ['อื่น ๆ']
 */
export function mapApiCategoryToThaiCategories(rawCategory?: string | null): BookCategory[] {
  if (!rawCategory || !rawCategory.trim()) {
    return [];
  }

  const matched: BookCategory[] = [];
  for (const { category, pattern } of CATEGORY_MATCHERS) {
    if (pattern.test(rawCategory) && !matched.includes(category)) {
      matched.push(category);
    }
  }

  return matched.length > 0 ? matched : ['อื่น ๆ'];
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 3,
    price: 20,
    note: 'ลองขาย 3 ออเดอร์',
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    credits: 10,
    price: 50,
    note: 'คุ้มที่สุด · ฿5 ต่อออเดอร์',
    isPopular: true,
  },
  {
    id: 'merchant',
    name: 'Merchant',
    credits: 25,
    price: 100,
    note: 'สำหรับร้านที่ขายเยอะ',
  },
];

export const SELLER_MEETUP_ZONES = [
  'หน้าหอสมุดกลาง มช.',
  'ประตูหน้า มช.',
  'หอพักนักศึกษา ชาย/หญิง',
  'คณะวิศวกรรมศาสตร์',
  'คณะมนุษยศาสตร์',
];

export const REPORT_REASONS = [
  'ผู้ซื้อไม่มาตามนัด',
  'ผู้ซื้อไม่ชำระเงิน',
  'หนังสือเสียหายระหว่างส่ง',
  'ผู้ซื้อไม่ตอบข้อความ',
  'อื่น ๆ',
];

export const GRADE_CRITERIA = [
  {
    grade: 'A',
    title: 'เหมือนใหม่',
    percent: 75,
    detail: 'ไม่มีตำหนิเลยทั้ง 5 จุด',
  },
  {
    grade: 'B',
    title: 'สภาพดีมาก',
    percent: 60,
    detail: 'มีตำหนิ 1 จุด และเป็นเพียงรอยใช้งานเล็กน้อย',
  },
  {
    grade: 'C',
    title: 'อ่านทั่วไป',
    percent: 45,
    detail: 'มีรอยเปื้อนหรือรอยเขียน 1 จุด หรือมีตำหนิ 2 จุด',
  },
  {
    grade: 'D',
    title: 'เน้นอ่าน',
    percent: 30,
    detail: 'มีตำหนิ 3 จุดขึ้นไป หรือหน้ากระดาษหลุด/ซ่อมเทป',
  },
];

export const DEFAULT_CONDITION_CHECKLIST: ConditionChecklist = {
  coverIntact: true,
  noHighlight: true,
  noWaterDamage: true,
  pagesComplete: true,
  noYellowing: true,
};

export function toUiBookGrade(grade?: string | null): BookGrade {
  switch (grade) {
    case 'A':
    case 'LIKE_NEW':
      return 'A';
    case 'B':
    case 'GENTLY_READ':
      return 'B';
    case 'C':
    case 'WELL_LOVED':
      return 'C';
    case 'D':
    case 'WORN_BUT_READABLE':
      return 'D';
    default:
      return 'B';
  }
}

export function toV4Grade(grade?: string | null): V4Grade {
  const ui = toUiBookGrade(grade);
  switch (ui) {
    case 'A':
      return 'LIKE_NEW';
    case 'B':
      return 'GENTLY_READ';
    case 'C':
      return 'WELL_LOVED';
    case 'D':
      return 'WORN_BUT_READABLE';
  }
}

export function checklistToConditionAnswers(c: ConditionChecklist) {
  return {
    covers: !c.coverIntact,
    markings: !c.noHighlight,
    stains: !c.noWaterDamage,
    pages: !c.pagesComplete,
    spine: !c.noYellowing,
  };
}

export function conditionAnswersToChecklist(
  answers?: Partial<Record<'covers' | 'markings' | 'stains' | 'pages' | 'spine', boolean>> | null
): ConditionChecklist {
  if (!answers) return { ...DEFAULT_CONDITION_CHECKLIST };
  return {
    coverIntact: !answers.covers,
    noHighlight: !answers.markings,
    noWaterDamage: !answers.stains,
    pagesComplete: !answers.pages,
    noYellowing: !answers.spine,
  };
}
