const THAI_WEEKDAY_CODES = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

export const HOURLY_SLOTS_BY_BLOCK: Record<string, string[]> = {
  'เช้า 9–12 น.': ['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00'],
  'บ่าย 12–16 น.': [
    '12:00 - 13:00',
    '13:00 - 14:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
  ],
  'เย็น 16–20 น.': [
    '16:00 - 17:00',
    '17:00 - 18:00',
    '18:00 - 19:00',
    '19:00 - 20:00',
  ],
};

const BLOCK_MINUTE_RANGES: Record<string, [number, number]> = {
  'เช้า 9–12 น.': [9 * 60, 12 * 60],
  'บ่าย 12–16 น.': [12 * 60, 16 * 60],
  'เย็น 16–20 น.': [16 * 60, 20 * 60],
};

/**
 * Returns today's YYYY-MM-DD in Asia/Bangkok (+07:00).
 */
export function getBangkokTodayIso(now: Date = new Date()): string {
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return bkk.toISOString().slice(0, 10);
}

/**
 * Maps YYYY-MM-DD to Thai weekday short code ('อา'..'ส') in Bangkok timezone.
 */
export function getBangkokWeekdayCode(dateIso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const d = new Date(`${dateIso}T12:00:00+07:00`);
  if (isNaN(d.getTime())) return null;
  const bkk = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return THAI_WEEKDAY_CODES[bkk.getUTCDay()] ?? null;
}

/**
 * Parses a slot label such as '16:00 - 17:00', '16:30 - 17:00', or 'เย็น 16–20 น.'
 * into [startMinutes, endMinutes] since midnight.
 */
export function parseSlotMinutesRange(label?: string | null): [number, number] | null {
  if (!label) return null;
  const clean = label.trim();
  if (BLOCK_MINUTE_RANGES[clean]) {
    return BLOCK_MINUTE_RANGES[clean];
  }

  const rangeMatch = clean.match(/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]) * 60 + Number(rangeMatch[2]);
    const end = Number(rangeMatch[3]) * 60 + Number(rangeMatch[4]);
    if (end > start) return [start, end];
  }

  const singleMatch = clean.match(/(\d{1,2})[:.](\d{2})/);
  if (singleMatch) {
    const start = Number(singleMatch[1]) * 60 + Number(singleMatch[2]);
    return [start, start + 60];
  }

  if (clean.includes('เช้า')) return BLOCK_MINUTE_RANGES['เช้า 9–12 น.'];
  if (clean.includes('บ่าย')) return BLOCK_MINUTE_RANGES['บ่าย 12–16 น.'];
  if (clean.includes('เย็น')) return BLOCK_MINUTE_RANGES['เย็น 16–20 น.'];

  return null;
}

export function slotsOverlap(aLabel?: string | null, bLabel?: string | null): boolean {
  if (!aLabel || !bLabel) return false;
  if (aLabel.trim() === bLabel.trim()) return true;
  const aRange = parseSlotMinutesRange(aLabel);
  const bRange = parseSlotMinutesRange(bLabel);
  if (!aRange || !bRange) return false;
  return aRange[0] < bRange[1] && bRange[0] < aRange[1];
}

export function isSlotWithinShopAvailability(
  candidateLabel: string,
  shopSlots: string[]
): boolean {
  if (!shopSlots || shopSlots.length === 0) return true;
  if (shopSlots.includes(candidateLabel.trim())) return true;
  const candidateRange = parseSlotMinutesRange(candidateLabel);
  if (!candidateRange) return false;

  return shopSlots.some((allowed) => {
    const allowedRange = parseSlotMinutesRange(allowed);
    if (!allowedRange) return false;
    return candidateRange[0] >= allowedRange[0] && candidateRange[1] <= allowedRange[1];
  });
}
