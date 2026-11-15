import type { IsbnLookupSource } from '@/types';

export interface IsbnSourcePresentation {
  badgeLabel: string;
  title: string;
  description: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
}

/**
 * แปลงสถานะแหล่งที่มาของการค้นหา ISBN ให้เป็นข้อความภาษาไทยที่ชัดเจนสำหรับแสดงใน UI
 */
export function getIsbnSourceMeta(
  source?: IsbnLookupSource,
  customMessage?: string
): IsbnSourcePresentation | null {
  switch (source) {
    case 'DATABASE':
      return {
        badgeLabel: 'พบใน Database ของเรา',
        title: 'พบข้อมูลหนังสือใน Database ของเรา (book_catalog)',
        description: customMessage || 'ดึงข้อมูลจากแคตตาล็อกกลางในระบบเรียบร้อยแล้ว',
        tone: 'emerald',
      };
    case 'GOOGLE_BOOKS':
      return {
        badgeLabel: 'พบใน Google Books API',
        title: 'พบข้อมูลหนังสือจาก Google Books API',
        description: customMessage || 'ดึงข้อมูลจาก Google Books API และแคชลง Database แล้ว',
        tone: 'sky',
      };
    case 'OPEN_LIBRARY':
      return {
        badgeLabel: 'พบใน Open Library API (สำรอง)',
        title: 'พบข้อมูลหนังสือจาก Open Library API',
        description:
          customMessage ||
          'ไม่พบใน Google Books หรือถูกจำกัดสิทธิ์ ระบบจึงดึงข้อมูลสำรองจาก Open Library ให้แทน',
        tone: 'amber',
      };
    case 'RATE_LIMITED':
      return {
        badgeLabel: 'Google Books API ติด 429',
        title: 'Google Books API ถูกจำกัดการใช้งานชั่วคราว (HTTP 429)',
        description:
          customMessage ||
          'ไม่พบใน Database และแหล่งสำรอง คุณสามารถกดถัดไปเพื่อกรอกข้อมูลหนังสือเองได้',
        tone: 'amber',
      };
    case 'NOT_FOUND':
      return {
        badgeLabel: 'ไม่พบในระบบ / API',
        title: 'ไม่พบข้อมูล ISBN นี้ทั้งใน Database และ Google Books / Open Library',
        description:
          customMessage ||
          'กรุณาตรวจสอบเลข ISBN หรือกด "ถัดไป · รายละเอียดหนังสือ" เพื่อกรอกข้อมูลด้วยตนเอง',
        tone: 'amber',
      };
    case 'ERROR':
      return {
        badgeLabel: 'ค้นหาไม่สำเร็จ',
        title: 'ไม่สามารถเชื่อมต่อระบบค้นหา ISBN ได้ชั่วคราว',
        description:
          customMessage ||
          'คุณยังสามารถกด "ถัดไป · รายละเอียดหนังสือ" เพื่อกรอกรายละเอียดหนังสือเองได้',
        tone: 'rose',
      };
    default:
      return null;
  }
}

export function getIsbnToneClasses(tone: IsbnSourcePresentation['tone']): {
  banner: string;
  badge: string;
} {
  switch (tone) {
    case 'emerald':
      return {
        banner: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'sky':
      return {
        banner: 'bg-sky-50 border-sky-200 text-sky-900',
        badge: 'bg-sky-100 text-sky-800 border-sky-200',
      };
    case 'amber':
      return {
        banner: 'bg-amber-50 border-amber-200 text-amber-900',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'rose':
      return {
        banner: 'bg-rose-50 border-rose-200 text-rose-900',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
      };
  }
}
