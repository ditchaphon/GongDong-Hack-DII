// =============================================================================
// Shipping Fee Service (Synced with Frontend v4 lib/delivery.ts)
// Formula: Flat base ฿50 first book + ฿10 per extra book (no cross-region fee)
// =============================================================================

const PROVINCE_REGION: Record<string, string> = {};

function assignRegion(region: string, provinces: string[]): void {
  for (const province of provinces) {
    PROVINCE_REGION[province] = region;
  }
}

assignRegion('N', [
  'เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่',
  'อุตรดิตถ์', 'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'กำแพงเพชร', 'เพชรบูรณ์',
  'นครสวรรค์', 'อุทัยธานี',
]);

assignRegion('S', [
  'กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา',
  'พัทลุง', 'ภูเก็ต', 'ยะลา', 'ระนอง', 'สงขลา', 'สตูล', 'สุราษฎร์ธานี',
]);

assignRegion('NE', [
  'กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์',
  'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'ศรีสะเกษ', 'สกลนคร',
  'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี',
]);

/**
 * คืนรหัสภูมิภาคของจังหวัด (N = เหนือ, S = ใต้, NE = อีสาน, C = กลาง/ตะวันออก/ตะวันตก)
 */
export function regionOfProvince(province?: string | null): string {
  if (!province) return 'C';
  return PROVINCE_REGION[province.trim()] ?? 'C';
}

/**
 * คำนวณค่าจัดส่งพัสดุตามสูตรมาตรฐานของกองดอง v4 (รองรับ COD):
 * - เล่มแรก ฿50 (ทั่วประเทศ ไม่คิดค่าข้ามภาคเพิ่ม)
 * - เล่มถัดไป +฿10/เล่ม
 */
export function calcParcelFee(
  bookCount: number,
  _fromProvince?: string | null,
  _toProvince?: string | null
): number {
  if (bookCount <= 0) return 0;
  return 50 + (bookCount - 1) * 10;
}
