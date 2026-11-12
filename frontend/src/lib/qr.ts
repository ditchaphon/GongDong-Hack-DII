/**
 * Mock QR matrix for the prototype. NOT a real PromptPay payload.
 * Real payloads are generated server-side in production.
 */

export const QR_SIZE = 21;

export function buildQrCells(seed: string, size: number = QR_SIZE): boolean[] {
  const cells: boolean[] = [];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  for (let i = 0; i < size * size; i += 1) {
    hash = (hash * 1103515245 + 12345) % 2147483648;
    cells.push(hash % 100 < 47);
  }
  return cells;
}

export function isFinderArea(row: number, col: number, size: number = QR_SIZE): boolean {
  const inTopLeft = row < 7 && col < 7;
  const inTopRight = row < 7 && col >= size - 7;
  const inBottomLeft = row >= size - 7 && col < 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

export function finderOrigins(size: number = QR_SIZE): { x: number; y: number }[] {
  return [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
}

export function formatTHB(value: number): string {
  return `฿${value.toLocaleString('th-TH')}`;
}
