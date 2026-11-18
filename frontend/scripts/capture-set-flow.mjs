import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(FRONTEND_DIR, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

const requireFromFrontend = createRequire(path.join(FRONTEND_DIR, 'package.json'));
const requireFromBackend = createRequire(path.join(BACKEND_DIR, 'package.json'));

const { chromium } = requireFromFrontend('playwright');

const BACKEND_PORT = Number(process.env.SET_CAPTURE_BACKEND_PORT || 8011);
const FRONTEND_PORT = Number(process.env.SET_CAPTURE_FRONTEND_PORT || 3011);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

const OUTPUT_DIR = path.join(FRONTEND_DIR, 'ui-snapshots', 'set-flow');

function loadDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function resolveChromiumExecutable() {
  try {
    const defaultPath = chromium.executablePath();
    if (defaultPath && fs.existsSync(defaultPath)) {
      return defaultPath;
    }
  } catch {
    // fallback to ms-playwright cache scan
  }

  const localAppData = process.env.LOCALAPPDATA || '';
  const cacheDirs = [
    path.join(localAppData, 'ms-playwright'),
    path.join(process.env.USERPROFILE || '', '.cache', 'ms-playwright'),
  ].filter((d) => d && fs.existsSync(d));

  for (const dir of cacheDirs) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
    const chromiumDirs = entries
      .filter((e) => e.name.startsWith('chromium-'))
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of chromiumDirs) {
      const candidates = [
        path.join(dir, entry.name, 'chrome-win64', 'chrome.exe'),
        path.join(dir, entry.name, 'chrome-linux', 'chrome'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  throw new Error('ไม่พบ Chromium binary ใน cache ของ Playwright');
}

async function discoverReadOnlyUserId() {
  const backendEnv = loadDotEnv(path.join(BACKEND_DIR, '.env'));
  const prevDbUrl = process.env.DATABASE_URL;
  const prevDirectUrl = process.env.DIRECT_URL;
  if (backendEnv.DATABASE_URL && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = backendEnv.DATABASE_URL;
  }
  if (backendEnv.DIRECT_URL && !process.env.DIRECT_URL) {
    process.env.DIRECT_URL = backendEnv.DIRECT_URL;
  }

  const { PrismaClient } = requireFromBackend('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const shop = await prisma.shopProfile.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { userId: true, shopName: true, province: true },
    });
    const anyUser = shop
      ? null
      : await prisma.user.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
    return {
      realUserId: shop?.userId || anyUser?.id || 'usr_mock_01',
      sellerName: shop?.shopName || 'ร้านหนังสือมังงะมือสอง',
      province: shop?.province || 'เชียงใหม่',
    };
  } finally {
    await prisma.$disconnect();
    if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDbUrl;
    if (prevDirectUrl === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = prevDirectUrl;
  }
}

function spawnService(name, command, args, cwd, extraEnv = {}) {
  const logLines = [];
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pushLog = (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) {
        logLines.push(line);
        if (logLines.length > 60) logLines.shift();
      }
    }
  };
  child.stdout?.on('data', pushLog);
  child.stderr?.on('data', pushLog);
  return { name, child, getRecentLogs: () => logLines.join('\n') };
}

async function waitForHttpReady(url, label, timeoutMs = 60_000, serviceHandle = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serviceHandle?.child.exitCode !== null && serviceHandle?.child.exitCode !== undefined) {
      throw new Error(
        `${label} exited prematurely with code ${serviceHandle.child.exitCode}\n${serviceHandle.getRecentLogs()}`
      );
    }
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}\n${serviceHandle?.getRecentLogs() || ''}`);
}

function killProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
    } catch {
      child.kill();
    }
  } else {
    child.kill('SIGTERM');
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ctx = await discoverReadOnlyUserId();
  const executablePath = resolveChromiumExecutable();
  console.log('[set-flow] Context:', ctx);
  console.log('[set-flow] Chromium:', executablePath);

  const backend = spawnService('backend', 'node', ['dist/index.js'], BACKEND_DIR, {
    NODE_ENV: 'development',
    PORT: String(BACKEND_PORT),
    FRONTEND_URL,
  });

  const frontend = spawnService(
    'frontend',
    'npx',
    ['next', 'dev', '--webpack', '-p', String(FRONTEND_PORT), '-H', '127.0.0.1'],
    FRONTEND_DIR,
    {
      NODE_ENV: 'development',
      NEXT_PUBLIC_LIFF_MOCK: 'true',
      NEXT_PUBLIC_USE_API_PROXY: 'true',
      BACKEND_INTERNAL_URL: BACKEND_URL,
      NEXT_PUBLIC_APP_URL: FRONTEND_URL,
    }
  );

  let browser;
  let context;
  try {
    await waitForHttpReady(`${BACKEND_URL}/api/health`, 'backend', 45_000, backend);
    await waitForHttpReady(`${FRONTEND_URL}/`, 'frontend', 90_000, frontend);
    console.log('[set-flow] Backend and Frontend ready.');

    browser = await chromium.launch({
      executablePath,
      headless: true,
    });

    context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      locale: 'th-TH',
    });

    const mockSetBookId = 'bok-set-demo';
    const mockOtherSellerId = 'usr-other-seller-demo';
    const nowIso = new Date().toISOString();

    const demoSetBookDetail = {
      id: mockSetBookId,
      isbn: '9786160838257',
      title: 'มหาศึกคนชนเทพ เล่ม 1-5 (ขาดเล่ม 4)',
      author: 'ชินยะ อุเมมูระ',
      publisher: 'Phoenix Next',
      category: 'MANGA',
      categories: ['MANGA'],
      isSet: true,
      totalVolumes: 5,
      missingVolumes: [4],
      coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800',
      price: 420,
      originalPrice: 620,
      grade: 'GOOD',
      allowPickup: true,
      allowDelivery: true,
      codEnabled: true,
      pickupLocationName: 'หน้าหอสมุด มช.',
      pickupLat: 18.796,
      pickupLng: 98.953,
      description: 'หนังสือชุดสะสม อ่านจบแล้ว สภาพดีมาก เล่ม 3 มีมุมปกพับเล็กน้อย ขาดเล่ม 4',
      status: 'AVAILABLE',
      conditionAnswers: {
        hasWriting: false,
        hasTornPages: false,
        hasWaterDamage: false,
        hasCreases: true,
        hasFadedPages: false,
      },
      defects: [
        {
          id: 'hasCreases',
          label: 'รอยพับ / ยับ / มุมปกงอ',
          note: 'เล่ม 3 มุมปกพับเล็กน้อย',
          photo: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=600',
        },
      ],
      images: [
        {
          id: 'img-1',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800',
          imageType: 'FRONT_COVER',
          displayOrder: 0,
          isCover: true,
        },
        {
          id: 'img-2',
          imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
          imageType: 'BACK_COVER',
          displayOrder: 1,
        },
        {
          id: 'img-3',
          imageUrl: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800',
          imageType: 'SPINE',
          displayOrder: 2,
        },
        {
          id: 'img-4',
          imageUrl: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800',
          imageType: 'OWNER_TAG',
          displayOrder: 3,
        },
      ],
      seller: {
        id: mockOtherSellerId,
        nickname: 'ร้านหนังสือมังงะสะสม',
        shopName: 'ร้านหนังสือมังงะสะสม เชียงใหม่',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        isVerifiedSeller: true,
      },
    };

    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} }),
        });
      }

      const headers = { ...request.headers() };
      if (headers.authorization?.includes('mock_usr_mock_01') && ctx.realUserId !== 'usr_mock_01') {
        headers.authorization = `Bearer mock_${ctx.realUserId}`;
      }

      if (pathname === '/api/books/isbn/9786160838257') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              found: true,
              isbn: '9786160838257',
              source: 'DATABASE',
              title: 'มหาศึกคนชนเทพ เล่ม 1',
              author: 'ชินยะ อุเมมูระ',
              publisher: 'Phoenix Next',
              category: 'MANGA',
              original_price: 155,
              previous_listings: [],
            },
          }),
        });
      }

      if (pathname === '/api/seller/shop') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              shop: {
                id: 'shop-demo-1',
                shop_name: ctx.sellerName,
                description: 'ขายหนังสือการ์ตูนและนิยายมือสองคัดสภาพ',
                avatar_url: null,
                province: ctx.province,
                available_days: ['MON', 'WED', 'FRI', 'SAT'],
                available_slots: ['16:00-18:00'],
                supports_parcel: true,
                ship_mode: 'AFTER_ACCEPT',
                ship_within_days: 2,
                setup_complete: true,
                meetup_points: [
                  {
                    id: 'pt-seller-1',
                    name: 'หน้าหอสมุดกลาง มช.',
                    province: ctx.province,
                    lat: 18.796,
                    lng: 98.953,
                  },
                ],
              },
              kyc: {
                first_name: 'สมชาย',
                last_name: 'ใจดี',
                national_id_masked: '1-xxxx-xxxxx-xx-1',
                verified_at: nowIso,
              },
              is_verified_seller: true,
              credits: 5,
            },
          }),
        });
      }

      if (pathname === `/api/books/${mockSetBookId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: demoSetBookDetail }),
        });
      }

      if (pathname === `/api/shops/${mockOtherSellerId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'shop-other-1',
              seller_id: mockOtherSellerId,
              shop_name: 'ร้านหนังสือมังงะสะสม เชียงใหม่',
              description: 'คัดสภาพทุกชุด แพ็กบับเบิลหนาอย่างดี',
              avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
              province: 'เชียงใหม่',
              payee_verified: true,
              rating: 4.9,
              total_reviews: 18,
              completed_sales: 42,
              member_since: '2025-01-15T00:00:00.000Z',
              supports_parcel: true,
              ship_mode: 'AFTER_ACCEPT',
              ship_within_days: 2,
              available_days: ['MON', 'WED', 'FRI', 'SAT'],
              available_slots: ['16:00-18:00'],
              meetup_points: [
                {
                  id: 'pt-demo-1',
                  name: 'หน้าหอสมุด มช.',
                  province: 'เชียงใหม่',
                  lat: 18.796,
                  lng: 98.953,
                },
              ],
            },
          }),
        });
      }

      if (pathname === `/api/users/${mockOtherSellerId}/reviews`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { reviews: [] } }),
        });
      }

      if (pathname === `/api/books/${mockSetBookId}/compare`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              currentBookId: mockSetBookId,
              isbn: '9786160838257',
              isSyntheticIsbn: false,
              totalOffers: 1,
              cheapestOfferPrice: 480,
              isCurrentBestGrade: false,
              offers: [
                {
                  id: 'bok-set-compare-2',
                  title: 'มหาศึกคนชนเทพ เล่ม 1-5 ครบชุด',
                  coverImageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400',
                  price: 480,
                  originalPrice: 775,
                  priceDiff: 60,
                  grade: 'LIKE_NEW',
                  defectCount: 0,
                  isSet: true,
                  totalVolumes: 5,
                  missingVolumes: [],
                  allowPickup: true,
                  pickupLocationName: 'BTS สยาม',
                  allowDelivery: true,
                  codEnabled: true,
                  isCheapest: false,
                  isBestGrade: true,
                  isSameSeller: false,
                  seller: {
                    id: 'usr-compare-shop',
                    nickname: 'ลุงพลการ์ตูน',
                    shopName: 'ร้านการ์ตูนลุงพล ครบชุด',
                    province: 'กรุงเทพมหานคร',
                    avatarUrl: null,
                    isVerifiedSeller: true,
                    rating: 4.8,
                    reviewCount: 32,
                    conditionAccuratePercent: 98,
                  },
                },
              ],
            },
          }),
        });
      }

      try {
        const resp = await route.fetch({ headers });
        return await route.fulfill({ response: resp });
      } catch {
        return route.abort().catch(() => {});
      }
    });

    const page = await context.newPage();
    page.on('pageerror', (err) => console.error('[set-flow][pageerror]', err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[set-flow][console.error]', msg.text());
      }
    });

    // 1. Step 1: /seller/list (SET mode: 5 volumes, missing vol 4, ISBN lookup)
    await page.goto(`${FRONTEND_URL}/seller/list`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("ขายยกชุด")', { timeout: 15_000 });
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: /ขายยกชุด/ }).click();
    await page.waitForTimeout(150);

    const plusBtn = page.getByRole('button', { name: 'เพิ่มจำนวนเล่ม' });
    for (let i = 0; i < 3; i += 1) {
      await plusBtn.click();
    }

    await page.getByRole('button', { name: 'แจ้งเล่มที่ขาดหาย' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: 'บันทึกเล่มที่ขาด' }).click();
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'พิมพ์เลข ISBN เอง' }).click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="978"]').fill('9786160838257');
    await page.getByRole('button', { name: 'ค้นหาหนังสือ' }).click();
    await page.waitForSelector('text=พบข้อมูลหนังสือแล้ว', { timeout: 10_000 });
    await page.waitForTimeout(3200);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01-seller-step1-set-scan.png'),
      fullPage: true,
    });
    console.log('[set-flow] Saved 01-seller-step1-set-scan.png');

    // 2. Step 2: /seller/list/details
    await page.getByRole('button', { name: /ถัดไป · รายละเอียดหนังสือ/ }).click();
    await page.waitForURL('**/seller/list/details');
    await page.waitForTimeout(400);

    await page.locator('#listing-title').fill('มหาศึกคนชนเทพ เล่ม 1-5 (ขาดเล่ม 4)');
    await page.locator('#listing-description').fill('ชุดสะสม สภาพดีมาก อ่านครั้งเดียว เล่ม 3 มุมปกพับเล็กน้อย');
    await page.waitForTimeout(250);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, '02-seller-step2-set-details.png'),
      fullPage: true,
    });
    console.log('[set-flow] Saved 02-seller-step2-set-details.png');

    await page.getByRole('button', { name: /แตะเพื่อใช้ราคารวม 4 เล่ม/ }).click();
    await page.waitForTimeout(150);

    // 3. Step 3: /seller/list/step-2 (Photos)
    await page.getByRole('button', { name: /ถัดไป · รูปถ่าย/ }).click();
    await page.waitForURL('**/seller/list/step-2');
    await page.waitForTimeout(400);

    const photoSlotLabels = [
      'ภาพรวมหน้าปกทั้งชุด',
      'ปกหลัง / ขอบกระดาษรวม',
      'สันหนังสือเรียงทุกเล่ม',
      'ตัวอย่างหน้าด้านใน',
    ];
    for (let i = 0; i < photoSlotLabels.length; i += 1) {
      const label = photoSlotLabels[i];
      await page.getByRole('button', { name: `เพิ่มรูป: ${label}` }).click();
      await page.waitForSelector('button[aria-label="ถ่ายรูป"]:not([disabled])', { timeout: 10_000 });
      await page.locator('button[aria-label="ถ่ายรูป"]').click();
      await page.getByRole('button', { name: 'ใช้รูปนี้' }).click();
      await page.waitForTimeout(200);
      if (i === 1) {
        // Capture with 2 photos filled + 2 SET hint boxes still visible
        await page.waitForTimeout(250);
        await page.screenshot({
          path: path.join(OUTPUT_DIR, '03-seller-step3-set-photos.png'),
          fullPage: true,
        });
        console.log('[set-flow] Saved 03-seller-step3-set-photos.png');
      }
    }

    // 4. Step 4: /seller/list/step-3 (Condition check with SET grading banner)
    await page.getByRole('button', { name: /ถัดไป · เช็กจุดตำหนิ 5 ข้อ/ }).click();
    await page.waitForURL('**/seller/list/step-3');
    await page.waitForTimeout(400);

    const coverGroup = page.getByRole('radiogroup', { name: 'ปกหน้าและปกหลัง' });
    await coverGroup.getByRole('radio', { name: /มีตำหนิ/ }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /แตะเพื่อถ่ายรูปตำหนิ:/ }).click();
    await page.waitForSelector('button[aria-label="ถ่ายรูป"]:not([disabled])', { timeout: 10_000 });
    await page.locator('button[aria-label="ถ่ายรูป"]').click();
    await page.getByRole('button', { name: 'ใช้รูปนี้' }).click();
    await page.waitForTimeout(200);
    await page.locator('input[placeholder*="เล่ม 3 มุมปกพับ"]').fill('เล่ม 3 มุมปกพับเล็กน้อย');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, '04-seller-step4-set-condition.png'),
      fullPage: true,
    });
    console.log('[set-flow] Saved 04-seller-step4-set-condition.png');

    // 5. Step 5: /seller/list/step-4 (Price & SET delivery fee)
    await page.getByRole('button', { name: /ถัดไป · ตั้งราคาและวิธีส่ง/ }).click();
    await page.waitForURL('**/seller/list/step-4');
    await page.waitForTimeout(500);

    await page.locator('input[aria-label="ราคาขาย"]').fill('420');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, '05-seller-step5-set-price.png'),
      fullPage: true,
    });
    console.log('[set-flow] Saved 05-seller-step5-set-price.png');

    // 6. Buyer SET Detail: /book/bok-set-demo
    await page.goto(`${FRONTEND_URL}/book/${mockSetBookId}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForSelector('text=มหาศึกคนชนเทพ เล่ม 1-5', { timeout: 30_000 });
    } catch (e) {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '06-buyer-set-detail-debug.png'),
        fullPage: true,
      });
      throw e;
    }
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, '06-buyer-set-detail.png'),
      fullPage: true,
    });
    console.log('[set-flow] Saved 06-buyer-set-detail.png');
  } finally {
    await context?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    if (browser) await browser.close();
    killProcessTree(frontend.child);
    killProcessTree(backend.child);
  }
}

main().catch((err) => {
  console.error('[set-flow] Failed:', err);
  process.exit(1);
});
