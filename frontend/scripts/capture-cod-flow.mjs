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

const BACKEND_PORT = Number(process.env.COD_CAPTURE_BACKEND_PORT || 8012);
const FRONTEND_PORT = Number(process.env.COD_CAPTURE_FRONTEND_PORT || 3012);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

const OUTPUT_DIR = path.join(FRONTEND_DIR, 'ui-snapshots', 'cod-flow');

// Valid 1x1 PNG (RGBA) base64 for testing PhotoUploader without relying on external files
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
  'base64'
);

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
      sellerName: shop?.shopName || 'ร้านหนังสือมังงะสะสม เชียงใหม่',
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

function makeOrderDetail({
  id,
  status,
  buyerId,
  sellerId,
  sellerShopName,
  includeDeliveryDetails = false,
  includeTracking = false,
  includeCompleted = false,
}) {
  const nowIso = new Date().toISOString();
  const futureUpdateIso = new Date(Date.now() - 2 * 3_600_000).toISOString();

  return {
    id,
    status,
    shipping_method: 'DELIVERY',
    payment_method: 'COD',
    shipping_fee: 80,
    total_price: 500,
    pickup_lat: null,
    pickup_lng: null,
    pickup_location_name: null,
    scheduled_at: null,
    schedule_date_iso: null,
    schedule_time_label: null,
    schedule_proposed_by: null,
    schedule_confirmed_by_buyer: false,
    handover_code: null,
    received_photo_url: includeCompleted
      ? 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600'
      : null,
    received_at: includeCompleted ? nowIso : null,
    cancel_reason: null,
    dispute: null,
    missed_meeting_reported_at: null,
    review: includeCompleted
      ? {
          rating: 5,
          is_condition_accurate: true,
          tags: ['ตรงปก', 'แพ็กดี'],
          comment: 'แพ็กบับเบิลมาหนามากครับ หนังสือสภาพตรงปกทุกเล่มเลย',
          created_at: nowIso,
        }
      : null,
    created_at: futureUpdateIso,
    updated_at: futureUpdateIso,
    items: [
      {
        book_id: 'bok-cod-demo',
        title: 'มหาศึกคนชนเทพ เล่ม 1-5 (ขาดเล่ม 4)',
        price: 420,
        cover_image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
        grade: 'GOOD',
      },
    ],
    buyer: {
      id: buyerId,
      nickname: 'นักอ่านสายมังงะ',
      avatar_url: null,
      no_show_count: 0,
    },
    seller: {
      id: sellerId,
      nickname: sellerShopName,
      shop_name: sellerShopName,
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      is_verified_seller: true,
    },
    delivery_details: includeDeliveryDetails
      ? {
          courier_name: includeTracking ? 'Flash Express' : null,
          tracking_number: includeTracking ? 'TH0123456789CM' : null,
          parcel_image_url: includeTracking
            ? 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600'
            : null,
          recipient_name: 'สมชาย ใจรักอ่าน',
          recipient_phone: '089-xxx-4512',
          delivery_address: '99/12 ถ.นิมมานเหมินท์ ซอย 9 ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
        }
      : null,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const ctx = await discoverReadOnlyUserId();
  const executablePath = resolveChromiumExecutable();
  console.log('[cod-flow] Context:', ctx);
  console.log('[cod-flow] Chromium:', executablePath);

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
    console.log('[cod-flow] Backend and Frontend ready.');

    browser = await chromium.launch({
      executablePath,
      headless: true,
    });

    context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      locale: 'th-TH',
    });

    const otherBuyerId = 'usr-other-buyer-cod';
    const otherSellerId = 'usr-other-seller-cod';
    const bookId = 'bok-cod-demo';
    const sellerDisplay = 'ร้านหนังสือมังงะสะสม เชียงใหม่';
    const nowIso = new Date().toISOString();

    const ordersById = {
      'ord-cod-buyer-req': makeOrderDetail({
        id: 'ord-cod-buyer-req',
        status: 'REQUESTED',
        buyerId: ctx.realUserId,
        sellerId: otherSellerId,
        sellerShopName: sellerDisplay,
      }),
      'ord-cod-seller-req': makeOrderDetail({
        id: 'ord-cod-seller-req',
        status: 'REQUESTED',
        buyerId: otherBuyerId,
        sellerId: ctx.realUserId,
        sellerShopName: ctx.sellerName,
      }),
      'ord-cod-seller-acc': makeOrderDetail({
        id: 'ord-cod-seller-acc',
        status: 'ACCEPTED',
        buyerId: otherBuyerId,
        sellerId: ctx.realUserId,
        sellerShopName: ctx.sellerName,
        includeDeliveryDetails: true,
      }),
      'ord-cod-buyer-acc': makeOrderDetail({
        id: 'ord-cod-buyer-acc',
        status: 'ACCEPTED',
        buyerId: ctx.realUserId,
        sellerId: otherSellerId,
        sellerShopName: sellerDisplay,
        includeDeliveryDetails: true,
      }),
      'ord-cod-seller-shp': makeOrderDetail({
        id: 'ord-cod-seller-shp',
        status: 'SHIPPED',
        buyerId: otherBuyerId,
        sellerId: ctx.realUserId,
        sellerShopName: ctx.sellerName,
        includeDeliveryDetails: true,
        includeTracking: true,
      }),
      'ord-cod-buyer-shp': makeOrderDetail({
        id: 'ord-cod-buyer-shp',
        status: 'SHIPPED',
        buyerId: ctx.realUserId,
        sellerId: otherSellerId,
        sellerShopName: sellerDisplay,
        includeDeliveryDetails: true,
        includeTracking: true,
      }),
      'ord-cod-buyer-cmp': makeOrderDetail({
        id: 'ord-cod-buyer-cmp',
        status: 'COMPLETED',
        buyerId: ctx.realUserId,
        sellerId: otherSellerId,
        sellerShopName: sellerDisplay,
        includeDeliveryDetails: true,
        includeTracking: true,
        includeCompleted: true,
      }),
      'ord-cod-seller-cmp': makeOrderDetail({
        id: 'ord-cod-seller-cmp',
        status: 'COMPLETED',
        buyerId: otherBuyerId,
        sellerId: ctx.realUserId,
        sellerShopName: ctx.sellerName,
        includeDeliveryDetails: true,
        includeTracking: true,
        includeCompleted: true,
      }),
    };

    const codBookDetail = {
      id: bookId,
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
      description: 'หนังสือชุดสะสม อ่านจบแล้ว สภาพดีมาก',
      status: 'AVAILABLE',
      conditionAnswers: {
        hasWriting: false,
        hasTornPages: false,
        hasWaterDamage: false,
        hasCreases: true,
        hasFadedPages: false,
      },
      defects: [],
      images: [
        {
          id: 'img-cod-1',
          imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800',
          imageType: 'FRONT_COVER',
          displayOrder: 0,
          isCover: true,
        },
      ],
      seller: {
        id: otherSellerId,
        nickname: sellerDisplay,
        shopName: sellerDisplay,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        isVerifiedSeller: true,
      },
    };

    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/api/upload') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600',
              path: 'order-receives/demo-box.webp',
              bucket: 'order-receives',
              isPrivate: false,
              isMocked: true,
            },
          }),
        });
      }

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

      if (pathname === `/api/books/${bookId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: codBookDetail }),
        });
      }

      if (pathname === `/api/shops/${otherSellerId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'shop-other-cod',
              seller_id: otherSellerId,
              shop_name: sellerDisplay,
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
                  id: 'pt-cod-1',
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

      if (pathname === '/api/users/me/addresses') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'addr-cod-1',
                full_name: 'สมชาย ใจรักอ่าน',
                province: 'เชียงใหม่',
                district: 'เมืองเชียงใหม่',
                subdistrict: 'สุเทพ',
                postal_code: '50200',
                detail: '99/12 ถ.นิมมานเหมินท์ ซอย 9',
                is_default: true,
              },
            ],
          }),
        });
      }

      if (pathname === '/api/users/me/orders') {
        const referer = request.headers().referer || '';
        const isCartCheckoutPage = referer.includes('/cart?') || referer.endsWith('/cart');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: isCartCheckoutPage
              ? { buying: [], selling: [], details: [] }
              : {
                  buying: [{ id: 'ord-cod-buyer-req' }],
                  selling: [{ id: 'ord-cod-seller-req' }],
                  details: Object.values(ordersById),
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
                id: 'shop-cod-seller',
                shop_name: ctx.sellerName,
                description: 'ร้านหนังสือมือสองคุณภาพ',
                avatar_url: null,
                province: ctx.province,
                available_days: ['MON', 'WED', 'FRI'],
                available_slots: ['16:00-18:00'],
                supports_parcel: true,
                ship_mode: 'AFTER_ACCEPT',
                ship_within_days: 2,
                setup_complete: true,
                meetup_points: [
                  {
                    id: 'pt-seller-cod',
                    name: 'หน้าหอสมุด มช.',
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

      const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (orderMatch && ordersById[orderMatch[1]]) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: ordersById[orderMatch[1]] }),
        });
      }

      const msgMatch = pathname.match(/^\/api\/orders\/([^/]+)\/messages$/);
      if (msgMatch) {
        const oid = msgMatch[1];
        const ord = ordersById[oid];
        const msgs =
          ord && ord.status !== 'REQUESTED'
            ? [
                {
                  id: `msg-${oid}-1`,
                  order_id: oid,
                  sender_id: ord.seller.id,
                  sender_role: 'SELLER',
                  type: 'TEXT',
                  text: 'แพ็กบับเบิลหนาให้อย่างดี เตรียมส่ง Flash Express ให้วันนี้นะครับ',
                  created_at: new Date(Date.now() - 1_800_000).toISOString(),
                },
                {
                  id: `msg-${oid}-2`,
                  order_id: oid,
                  sender_id: ord.buyer.id,
                  sender_role: 'BUYER',
                  type: 'TEXT',
                  text: 'ขอบคุณมากครับ รอรับและจ่ายเงินปลายทางครับ',
                  created_at: new Date(Date.now() - 900_000).toISOString(),
                },
              ]
            : [];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { messages: msgs } }),
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
    page.on('pageerror', (err) => console.error('[cod-flow][pageerror]', err.message));

    const saveShot = async (filename) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUTPUT_DIR, filename), fullPage: true });
      console.log(`[cod-flow] Saved ${filename}`);
    };

    // 01. Buyer Cart (COD selected)
    await page.goto(`${FRONTEND_URL}/cart?buyNow=${bookId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('button:has-text("ส่งพัสดุ")', { timeout: 25_000 });
    await page.getByRole('button', { name: /ส่งพัสดุ/ }).click();
    await page.waitForSelector('text=เก็บเงินปลายทาง', { timeout: 15_000 });
    await saveShot('01-buyer-cart-cod.png');

    // 02. Buyer Cart Success
    await page.goto(`${FRONTEND_URL}/cart/success?id=ord-cod-buyer-req`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('text=ส่งคำขอซื้อแล้ว', { timeout: 25_000 });
    await saveShot('02-buyer-cart-success.png');

    // 03. Buyer Order REQUESTED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-buyer-req`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=รอผู้ขายตอบรับ', { timeout: 30_000 });
    await saveShot('03-buyer-order-requested.png');

    // 04. Seller Order REQUESTED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-seller-req`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ตอบรับคำขอนี้?', { timeout: 25_000 });
    await saveShot('04-seller-order-requested.png');

    // 05. Seller Order ACCEPTED (Recipient address + Confirm shipment CTA)
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-seller-acc`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ยืนยันการส่งและใส่เลขพัสดุ', { timeout: 25_000 });
    await saveShot('05-seller-order-accepted.png');

    // 06. Seller Tracking Form (/orders/[id]/tracking)
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-seller-acc/tracking`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('#tracking', { timeout: 25_000 });
    await page.locator('#carrier').selectOption('Flash Express');
    await page.locator('#tracking').fill('TH0123456789CM');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'parcel-box.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });
    await page.waitForTimeout(700);
    await saveShot('06-seller-tracking-form.png');

    // 07. Buyer Order ACCEPTED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-buyer-acc`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=รอผู้ขายยืนยันการส่ง', { timeout: 25_000 });
    await saveShot('07-buyer-order-accepted.png');

    // 08. Seller Order SHIPPED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-seller-shp`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ส่งแล้ว · รอผู้ซื้อรับของ', { timeout: 25_000 });
    await saveShot('08-seller-order-shipped.png');

    // 09. Buyer Order SHIPPED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-buyer-shp`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ได้รับของแล้ว · ถ่ายรูปยืนยัน', { timeout: 25_000 });
    await saveShot('09-buyer-order-shipped.png');

    // 10. Buyer Receive & Review (/orders/[id]/receive)
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-buyer-shp/receive`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('button:has-text("เปิดกล้องถ่ายรูป")', { timeout: 25_000 });
    await page.getByRole('button', { name: 'เปิดกล้องถ่ายรูป' }).click();
    await page.waitForSelector('button[aria-label="ถ่ายรูป"]:not([disabled])', { timeout: 10_000 });
    await page.locator('button[aria-label="ถ่ายรูป"]').click();
    await page.getByRole('button', { name: 'ใช้รูปนี้' }).click();
    await page.waitForTimeout(200);
    await page.getByRole('radio', { name: '5 ดาว' }).click();
    await page.getByRole('button', { name: '✓ ตรงเกรด' }).click();
    await page.getByRole('button', { name: 'ตรงปก', exact: true }).click();
    await page.getByRole('button', { name: 'แพ็กดี', exact: true }).click();
    await page
      .locator('textarea')
      .fill('แพ็กบับเบิลมาหนามากครับ หนังสือสภาพตรงปกทุกเล่มเลย');
    await saveShot('10-buyer-receive-review.png');

    // 11. Buyer Order COMPLETED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-buyer-cmp`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ได้รับหนังสือแล้ว', { timeout: 25_000 });
    await saveShot('11-buyer-order-completed.png');

    // 12. Seller Order COMPLETED
    await page.goto(`${FRONTEND_URL}/orders/ord-cod-seller-cmp`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=ปิดการขายแล้ว', { timeout: 25_000 });
    await saveShot('12-seller-order-completed.png');
  } finally {
    await context?.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    if (browser) await browser.close();
    killProcessTree(frontend.child);
    killProcessTree(backend.child);
  }
}

main().catch((err) => {
  console.error('[cod-flow] Failed:', err);
  process.exit(1);
});
