/**
 * Delivery rules shared by buyer and seller screens.
 * - Meet-up points are created by the seller, anywhere in Thailand.
 * - Parcel fees are calculated by GongDong; sellers never type a fee.
 */

export interface MeetupPoint {
  id: string;
  name: string;
  province: string;
  lat: number;
  lng: number;
  note?: string;
}

/** DAILY = ships every day; AFTER_ACCEPT = ships within N days of payment. */
export type ShipMode = 'DAILY' | 'AFTER_ACCEPT';

export const THAI_PROVINCES = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี',
  'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด',
  'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี',
  'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี',
  'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์',
  'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด', 'ระนอง',
  'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล',
  'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย',
  'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ',
  'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
];

/** Approximate province centres used to drop a first pin for new meet-up points. */
const PROVINCE_CENTRE: Record<string, [number, number]> = {
  กรุงเทพมหานคร: [13.7563, 100.5018],
  เชียงใหม่: [18.7883, 98.9853],
  เชียงราย: [19.9105, 99.8406],
  ขอนแก่น: [16.4419, 102.836],
  นครราชสีมา: [14.9799, 102.0977],
  ภูเก็ต: [7.8804, 98.3923],
  สงขลา: [7.1897, 100.5954],
  ชลบุรี: [13.3611, 100.9847],
  นนทบุรี: [13.8591, 100.5217],
  ปทุมธานี: [14.0208, 100.525],
  พิษณุโลก: [16.8211, 100.2659],
  อุบลราชธานี: [15.2287, 104.8564],
  อุดรธานี: [17.4138, 102.787],
  สุราษฎร์ธานี: [9.1382, 99.3215],
};

export function provinceCentre(province: string): { lat: number; lng: number } {
  const [lat, lng] = PROVINCE_CENTRE[province] ?? [13.7563, 100.5018];
  return { lat, lng };
}

const REGION: Record<string, string> = {};
const assign = (region: string, list: string[]) => list.forEach((p) => (REGION[p] = region));
assign('N', ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์', 'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'กำแพงเพชร', 'เพชรบูรณ์', 'นครสวรรค์', 'อุทัยธานี']);
assign('S', ['กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา', 'พัทลุง', 'ภูเก็ต', 'ยะลา', 'ระนอง', 'สงขลา', 'สตูล', 'สุราษฎร์ธานี']);
assign('NE', ['กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี']);

const regionOf = (province?: string) => (province ? REGION[province] ?? 'C' : 'C');

/**
 * GongDong-calculated parcel fee (prototype rates):
 * ฿35 first book, +฿10 per extra book, +฿15 when crossing regions.
 */
export function calcParcelFee(bookCount: number, fromProvince?: string, toProvince?: string): number {
  if (bookCount <= 0) return 0;
  const crossRegion = !!fromProvince && !!toProvince && regionOf(fromProvince) !== regionOf(toProvince);
  return 35 + (bookCount - 1) * 10 + (crossRegion ? 15 : 0);
}

export function shipModeLabel(mode: ShipMode, withinDays: number): string {
  return mode === 'DAILY'
    ? 'ส่งของทุกวัน · ส่งภายใน 1 วันหลังชำระเงิน'
    : `ส่งภายใน ${withinDays} วันหลังชำระเงิน`;
}

export function shipDeadlineDays(mode: ShipMode, withinDays: number): number {
  return mode === 'DAILY' ? 1 : withinDays;
}

/** Google Maps embed URL (no API key needed) and a directions link. */
export const mapEmbedUrl = (lat: number, lng: number) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;

export const mapDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Next N calendar dates that fall on the seller's available weekdays. */
const DAY_CODES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar date as YYYY-MM-DD (toISOString would shift to UTC). */
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Parse YYYY-MM-DD as a local date, not UTC midnight. */
const parseLocal = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export function upcomingDates(availableDays: string[], count = 6, from = new Date()) {
  const out: { iso: string; label: string }[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 1; out.length < count && i < 30; i += 1) {
    const day = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + i);
    if (availableDays.includes(DAY_CODES[day.getDay()])) {
      out.push({
        iso: localISO(day),
        label: day.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }),
      });
    }
  }
  return out;
}

export function formatThaiDate(iso: string) {
  return parseLocal(iso).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Convert YYYY-MM-DD + Thai time-slot label into an accurate Bangkok (+07:00) ISO timestamp.
 */
export function scheduleToIso(dateISO: string, timeLabel?: string): string {
  const datePart = dateISO.slice(0, 10);
  const label = timeLabel ?? '';
  let hour = 10;
  let minute = 0;

  const explicit = label.match(/(\d{1,2})[:.](\d{2})/);
  if (explicit) {
    hour = Math.min(23, Math.max(0, Number(explicit[1])));
    minute = Math.min(59, Math.max(0, Number(explicit[2])));
  } else if (label.includes('เย็น') || label.includes('16') || label.includes('17') || label.includes('18')) {
    hour = 17;
  } else if (label.includes('บ่าย') || label.includes('13') || label.includes('14') || label.includes('15')) {
    hour = 14;
  } else if (label.includes('เช้า') || label.includes('9') || label.includes('10')) {
    hour = 10;
  }

  return new Date(`${datePart}T${pad(hour)}:${pad(minute)}:00+07:00`).toISOString();
}
