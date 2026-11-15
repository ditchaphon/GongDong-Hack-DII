import { BookGrade, ConditionAnswers, GradingResult } from '../types';

export const GRADE_DISCOUNT_PERCENTAGES: Record<BookGrade, number> = {
  LIKE_NEW: 0.75,
  GENTLY_READ: 0.60,
  WELL_LOVED: 0.45,
  WORN_BUT_READABLE: 0.30,
};

/**
 * คำนวณเกรดหนังสือและราคาแนะนำอัตโนมัติจากผลเช็กสภาพ 5 จุดและราคาปกตั้งต้น
 * 
 * กฎทางธุรกิจ (อ้างอิง docs/API.md หัวข้อ 2.2):
 * - LIKE_NEW (75%): ไม่มีตำหนิเลย (0 จุด)
 * - GENTLY_READ (60%): มีตำหนิ 1 จุด และเป็นเพียง spine หรือ covers เล็กน้อย
 * - WELL_LOVED (45%): มีรอยเปื้อน/ขีดเขียน 1 จุด (stains/markings) หรือมีตำหนิรวม 2 จุด
 * - WORN_BUT_READABLE (30%): มีตำหนิตั้งแต่ 3 จุดขึ้นไป หรือมี pages หลุด/ซ่อมเทป
 *
 * @param conditionAnswers ผลการตอบคำถามสภาพ 5 จุด
 * @param originalPrice ราคาปกตั้งต้น (บาท)
 * @returns GradingResult เกรด, สัดส่วนราคาแนะนำ, และราคาแนะนำที่คำนวณแล้ว
 */
export function calculateBookGrade(
  conditionAnswers: ConditionAnswers,
  originalPrice: number
): GradingResult {
  if (originalPrice < 0 || isNaN(originalPrice)) {
    throw new Error('ราคาปก (originalPrice) ต้องไม่ติดลบและเป็นตัวเลขที่ถูกต้อง');
  }

  const { spine, stains, markings, covers, pages } = conditionAnswers;

  let grade: BookGrade;

  // กฎพิเศษ: หากหน้ากระดาษหลุดหรือซ่อมเทป (pages) ตกเกรด WORN_BUT_READABLE ทันที
  if (pages) {
    grade = 'WORN_BUT_READABLE';
  } else {
    // นับจำนวนจุดตำหนิรวม
    const defectCount = [spine, stains, markings, covers].filter(Boolean).length;

    if (defectCount === 0) {
      grade = 'LIKE_NEW';
    } else if (defectCount === 1) {
      if (spine || covers) {
        grade = 'GENTLY_READ';
      } else {
        // ตำหนิ 1 จุดแต่เป็น stains หรือ markings
        grade = 'WELL_LOVED';
      }
    } else if (defectCount === 2) {
      grade = 'WELL_LOVED';
    } else {
      // defectCount >= 3
      grade = 'WORN_BUT_READABLE';
    }
  }

  const discountPercent = GRADE_DISCOUNT_PERCENTAGES[grade];
  const recommendedPrice = Math.round(originalPrice * discountPercent);

  return {
    grade,
    discountPercent,
    recommendedPrice,
  };
}
