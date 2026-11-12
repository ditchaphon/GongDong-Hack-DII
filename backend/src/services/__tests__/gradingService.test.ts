import { describe, it, expect } from 'vitest';
import { calculateBookGrade, GRADE_DISCOUNT_PERCENTAGES } from '../gradingService';
import { ConditionAnswers } from '../../types';

describe('GradingService - Book Grading & Price Recommendation', () => {
  const cleanAnswers: ConditionAnswers = {
    spine: false,
    stains: false,
    markings: false,
    covers: false,
    pages: false,
  };

  it('ควรตัดเกรด LIKE_NEW (75%) เมื่อไม่มีตำหนิเลย (0 จุด)', () => {
    const result = calculateBookGrade(cleanAnswers, 300);

    expect(result.grade).toBe('LIKE_NEW');
    expect(result.discountPercent).toBe(0.75);
    expect(result.recommendedPrice).toBe(225); // 300 * 0.75
  });

  it('ควรตัดเกรด GENTLY_READ (60%) เมื่อมีตำหนิ 1 จุดที่ spine', () => {
    const answers: ConditionAnswers = { ...cleanAnswers, spine: true };
    const result = calculateBookGrade(answers, 200);

    expect(result.grade).toBe('GENTLY_READ');
    expect(result.discountPercent).toBe(0.60);
    expect(result.recommendedPrice).toBe(120); // 200 * 0.60
  });

  it('ควรตัดเกรด GENTLY_READ (60%) เมื่อมีตำหนิ 1 จุดที่ covers', () => {
    const answers: ConditionAnswers = { ...cleanAnswers, covers: true };
    const result = calculateBookGrade(answers, 250);

    expect(result.grade).toBe('GENTLY_READ');
    expect(result.discountPercent).toBe(0.60);
    expect(result.recommendedPrice).toBe(150); // 250 * 0.60
  });

  it('ควรตัดเกรด WELL_LOVED (45%) เมื่อมีตำหนิ 1 จุดที่ stains', () => {
    const answers: ConditionAnswers = { ...cleanAnswers, stains: true };
    const result = calculateBookGrade(answers, 290);

    expect(result.grade).toBe('WELL_LOVED');
    expect(result.discountPercent).toBe(0.45);
    expect(result.recommendedPrice).toBe(130.50); // 290 * 0.45 = 130.50
  });

  it('ควรตัดเกรด WELL_LOVED (45%) เมื่อมีตำหนิ 1 จุดที่ markings', () => {
    const answers: ConditionAnswers = { ...cleanAnswers, markings: true };
    const result = calculateBookGrade(answers, 100);

    expect(result.grade).toBe('WELL_LOVED');
    expect(result.discountPercent).toBe(0.45);
    expect(result.recommendedPrice).toBe(45);
  });

  it('ควรตัดเกรด WELL_LOVED (45%) เมื่อมีตำหนิรวม 2 จุด (spine + stains)', () => {
    const answers: ConditionAnswers = {
      ...cleanAnswers,
      spine: true,
      stains: true,
    };
    const result = calculateBookGrade(answers, 400);

    expect(result.grade).toBe('WELL_LOVED');
    expect(result.discountPercent).toBe(0.45);
    expect(result.recommendedPrice).toBe(180);
  });

  it('ควรตัดเกรด WORN_BUT_READABLE (30%) ทันทีหาก pages หลุดหรือซ่อมเทป แม้มีตำหนิเพียงจุดเดียว', () => {
    const answers: ConditionAnswers = {
      ...cleanAnswers,
      pages: true,
    };
    const result = calculateBookGrade(answers, 300);

    expect(result.grade).toBe('WORN_BUT_READABLE');
    expect(result.discountPercent).toBe(0.30);
    expect(result.recommendedPrice).toBe(90);
  });

  it('ควรตัดเกรด WORN_BUT_READABLE (30%) เมื่อมีตำหนิตั้งแต่ 3 จุดขึ้นไป', () => {
    const answers: ConditionAnswers = {
      spine: true,
      stains: true,
      markings: true,
      covers: false,
      pages: false,
    };
    const result = calculateBookGrade(answers, 500);

    expect(result.grade).toBe('WORN_BUT_READABLE');
    expect(result.discountPercent).toBe(0.30);
    expect(result.recommendedPrice).toBe(150);
  });

  it('ควรปัดเศษทศนิยม 2 ตำแหน่งอย่างถูกต้องสำหรับราคาที่มีเศษสตางค์', () => {
    // 299 * 0.75 = 224.25
    const result = calculateBookGrade(cleanAnswers, 299);
    expect(result.recommendedPrice).toBe(224.25);

    // 199 * 0.45 = 89.55
    const wellLovedResult = calculateBookGrade(
      { ...cleanAnswers, stains: true },
      199
    );
    expect(wellLovedResult.recommendedPrice).toBe(89.55);
  });

  it('ควรโยน Error เมื่อระบุราคาปกติดลบ', () => {
    expect(() => calculateBookGrade(cleanAnswers, -50)).toThrow(
      'ราคาปก (originalPrice) ต้องไม่ติดลบและเป็นตัวเลขที่ถูกต้อง'
    );
  });

  it('ควรโยน Error เมื่อระบุราคาปกเป็น NaN', () => {
    expect(() => calculateBookGrade(cleanAnswers, NaN)).toThrow(
      'ราคาปก (originalPrice) ต้องไม่ติดลบและเป็นตัวเลขที่ถูกต้อง'
    );
  });
});
