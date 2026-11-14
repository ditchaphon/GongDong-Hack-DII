// =============================================================================
// Shipping Fee Service (Synced with Frontend v4 lib/delivery.ts)
// Formula: ฿35 first book + ฿10 per extra book + ฿15 when crossing regions
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
 * คำนวณค่าจัดส่งพัสดุตามสูตรมาตรฐานของกองดอง v4:
 * - เล่มแรก ฿35
 * - เล่มถัดไป +฿10/เล่ม
 * - ข้ามภาคระหว่างจังหวัดต้นทาง-ปลายทาง +฿15
 */
export function calcParcelFee(
  bookCount: number,
  fromProvince?: string | null,
  toProvince?: string | null
): number {
  if (bookCount <= 0) return 0;
  const crossRegion =
    Boolean(fromProvince) &&
    Boolean(toProvince) &&
    regionOfProvince(fromProvince) !== regionOfProvince(toProvince);

  return 35 + (bookCount - 1) * 10 + (crossRegion ? 15 : 0);
}
