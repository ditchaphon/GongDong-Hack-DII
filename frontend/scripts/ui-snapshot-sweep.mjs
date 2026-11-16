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

const BACKEND_PORT = Number(process.env.SWEEP_BACKEND_PORT || 8010);
const FRONTEND_PORT = Number(process.env.SWEEP_FRONTEND_PORT || 3010);
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

const OUTPUT_DIR = path.join(FRONTEND_DIR, 'ui-snapshots', 'latest');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');

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
    // Prefer full chromium over headless shell, newest revision first
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

    const shellDirs = entries
      .filter((e) => e.name.startsWith('chromium_headless_shell-'))
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of shellDirs) {
      const candidate = path.join(
        dir,
        entry.name,
        'chrome-headless-shell-win64',
        'chrome-headless-shell.exe'
      );
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  throw new Error(
    'ไม่พบ Chromium binary ใน cache ของ Playwright กรุณารัน `npx playwright install chromium`'
  );
}

async function discoverReadOnlyIds() {
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
    const [shopWithUser, availableBook, anyBook, anyOrder, anyUser] = await Promise.all([
      prisma.shopProfile.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { userId: true, shopName: true, province: true },
      }),
      prisma.bookListing.findFirst({
        where: { status: 'AVAILABLE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, sellerId: true },
      }),
      prisma.bookListing.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, sellerId: true },
      }),
      prisma.order.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true, buyerId: true, sellerId: true },
      }),
      prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      }),
    ]);

    const selectedBook = availableBook || anyBook;
    const realUserId =
      anyOrder?.buyerId ||
      shopWithUser?.userId ||
      selectedBook?.sellerId ||
      anyUser?.id ||
      'usr_mock_01';

    let userOrder = null;
    let userBook = null;
    if (realUserId !== 'usr_mock_01') {
      [userOrder, userBook] = await Promise.all([
        prisma.order.findFirst({
          where: { OR: [{ buyerId: realUserId }, { sellerId: realUserId }] },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
        prisma.bookListing.findFirst({
          where: { sellerId: realUserId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        }),
      ]);
    }

    return {
      realUserId,
      bookId: selectedBook?.id || 'bok-sweep-demo',
      sellerId: shopWithUser?.userId || selectedBook?.sellerId || realUserId,
      sellerName: shopWithUser?.shopName || 'ร้านหนังสือทดสอบ',
      sellerProvince: shopWithUser?.province || 'เชียงใหม่',
      orderId: userOrder?.id || 'ord-sweep-demo',
      hasRealOrderForUser: Boolean(userOrder?.id),
      listingId: userBook?.id || selectedBook?.id || 'bok-sweep-demo',
      hasRealListingForUser: Boolean(userBook?.id),
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
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        logLines.push(line);
        if (logLines.length > 80) logLines.shift();
      }
    }
  };
  child.stdout?.on('data', pushLog);
  child.stderr?.on('data', pushLog);

  return {
    name,
    child,
    getRecentLogs: () => logLines.join('\n'),
  };
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
      // keep polling
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

function buildFallbackOrderDetail(ctx) {
  const nowIso = new Date().toISOString();
  const futureDate = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  return {
    id: ctx.orderId,
    status: 'SHIPPED',
    shipping_method: 'DELIVERY',
    payment_method: 'COD',
    shipping_fee: 50,
    total_price: 250,
    pickup_lat: 18.796,
    pickup_lng: 98.953,
    pickup_location_name: 'หน้าหอสมุด มช.',
    scheduled_at: `${futureDate}T16:00:00+07:00`,
    schedule_date_iso: futureDate,
    schedule_time_label: '16:00 - 17:00',
    schedule_proposed_by: ctx.realUserId,
    schedule_confirmed_by_buyer: true,
    handover_code: '482910',
    received_photo_url: null,
    received_at: null,
    cancel_reason: null,
    dispute: null,
    missed_meeting_reported_at: null,
    review: null,
    items: [
      {
        book_id: ctx.bookId,
        title: 'Clean Code ฉบับภาษาไทย (ตัวอย่างสำหรับทดสอบ UI)',
        price: 200,
        cover_image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
        grade: 'GOOD',
      },
    ],
    buyer: {
      id: ctx.realUserId,
      nickname: 'ผู้ซื้อทดสอบ UI',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      phone_number: null,
      no_show_count: 0,
    },
    seller: {
      id: ctx.sellerId,
      nickname: ctx.sellerName,
      shop_name: ctx.sellerName,
      avatar_url: null,
      verified_name: null,
      is_verified_seller: true,
    },
    delivery_details: {
      recipient_name: 'ผู้ซื้อทดสอบ UI',
      recipient_phone: '0812345678',
      province: 'เชียงใหม่',
      delivery_address: '239 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200',
      courier_name: 'Flash Express',
      tracking_number: 'TH0123456789AB',
      parcel_image_url: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600',
      shipped_at: nowIso,
    },
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function buildFallbackAdminDispute(ctx) {
  const nowIso = new Date().toISOString();
  return {
    id: 'ord-admin-sweep-1',
    status: 'DISPUTED',
    shippingMethod: 'PICKUP',
    paymentMethod: 'COD',
    totalPrice: 220,
    shippingFee: 0,
    cancelReason: null,
    receivedPhotoUrl: null,
    paymentSlipUrl: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    dispute: {
      reason: 'ผู้ซื้อไม่ได้มาตามเวลานัดหมาย (ตัวอย่างสำหรับ Sweep UI)',
      openedBy: 'SELLER',
      openedAt: nowIso,
      missedMeetingReportedAt: nowIso,
    },
    schedule: {
      locationName: 'หน้าหอสมุด มช.',
      dateIso: nowIso.slice(0, 10),
      timeLabel: '16:00 - 17:00',
      scheduledAt: nowIso,
      confirmedByBuyer: true,
    },
    buyer: {
      id: 'usr-buyer-demo',
      nickname: 'น้องบิว (ผู้ซื้อ)',
      displayName: 'น้องบิว',
      avatarUrl: null,
      noShowCount: 1,
    },
    seller: {
      id: ctx.sellerId,
      nickname: ctx.sellerName,
      displayName: ctx.sellerName,
      shopName: ctx.sellerName,
      credits: 3,
    },
    items: [
      {
        bookId: ctx.bookId,
        title: 'Designing Data-Intensive Applications',
        price: 220,
        grade: 'LIKE_NEW',
        coverImageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
      },
    ],
    recentMessages: [
      {
        id: 'msg-1',
        senderRole: 'SELLER',
        senderName: ctx.sellerName,
        kind: 'TEXT',
        text: 'รอหน้าหอสมุด มช. 15 นาทีแล้วครับ',
        createdAt: nowIso,
      },
    ],
  };
}

function buildRouteList(ctx) {
  return [
    { id: '01_home', path: '/', label: 'หน้าแรก (Buyer Home)' },
    { id: '02_onboarding', path: '/onboarding', label: 'แนะนำแอป (Onboarding)' },
    { id: '03_search', path: '/search', label: 'ค้นหาหนังสือ' },
    { id: '04_book_detail', path: `/book/${ctx.bookId}`, label: 'รายละเอียดหนังสือ + เทียบ ISBN' },
    { id: '05_cart', path: '/cart', label: 'ตะกร้าสินค้า' },
    { id: '06_cart_success', path: `/cart/success?id=${encodeURIComponent(ctx.orderId)}`, label: 'สั่งซื้อสำเร็จ' },
    { id: '08_addresses', path: '/addresses', label: 'ที่อยู่จัดส่ง' },
    { id: '09_addresses_edit', path: '/addresses/edit', label: 'เพิ่ม/แก้ไขที่อยู่' },
    { id: '10_notifications', path: '/notifications', label: 'การแจ้งเตือน' },
    { id: '11_profile', path: '/profile', label: 'โปรไฟล์ผู้ใช้' },
    { id: '12_setup', path: '/setup', label: 'ตั้งค่าโปรไฟล์/PDPA' },
    { id: '13_help', path: '/help', label: 'ช่วยเหลือ & FAQ' },
    { id: '14_orders', path: '/orders', label: 'รายการออเดอร์' },
    { id: '15_order_detail', path: `/orders/${ctx.orderId}`, label: 'รายละเอียดออเดอร์' },
    { id: '16_order_schedule', path: `/orders/${ctx.orderId}/schedule`, label: 'นัดหมายวัน-เวลารับหนังสือ' },
    { id: '17_order_tracking', path: `/orders/${ctx.orderId}/tracking`, label: 'ติดตามพัสดุ (กรอกเลข/สถานะ)' },
    { id: '18_order_receive', path: `/orders/${ctx.orderId}/receive`, label: 'ยืนยันรับหนังสือ' },
    { id: '19_order_review', path: `/orders/${ctx.orderId}/review`, label: 'รีวิวร้านค้า' },
    { id: '20_order_no_show', path: `/orders/${ctx.orderId}/no-show`, label: 'แจ้งไม่มาตามนัด' },
    { id: '21_seller_home', path: '/seller', label: 'แดชบอร์ดร้านค้า (Seller)' },
    { id: '22_seller_public', path: `/seller/${ctx.sellerId}`, label: 'หน้าร้านค้าสาธารณะ' },
    { id: '23_seller_setup', path: '/seller/setup', label: 'ตั้งค่าร้านค้า & KYC' },
    { id: '23b_seller_setup_delivery', path: '/seller/setup?step=3', label: 'ตั้งค่าร้านค้า (Step 3: ตารางจัดส่ง)' },
    { id: '23c_seller_setup_kyc', path: '/seller/setup?step=4', label: 'ตั้งค่าร้านค้า (Step 4: ข้อมูล KYC)' },
    { id: '24_seller_credits', path: '/seller/credits', label: 'เครดิตร้านค้า' },
    { id: '25_seller_credits_pay', path: '/seller/credits/pay', label: 'ชำระเงินเติมเครดิต' },
    { id: '26_seller_credits_verify', path: '/seller/credits/verify', label: 'ยืนยันเครดิต (Redirect -> setup?step=4)', expectRedirectTo: '/seller/setup' },
    { id: '27_seller_credits_success', path: '/seller/credits/success', label: 'เติมเครดิตสำเร็จ' },
    { id: '28_seller_list_step1', path: '/seller/list', label: 'ลงขาย Step 1: สแกน ISBN' },
    { id: '29_seller_list_details', path: '/seller/list/details', label: 'ลงขาย Step 2: รายละเอียดหนังสือ' },
    { id: '30_seller_list_step2', path: '/seller/list/step-2', label: 'ลงขาย Step 3: ถ่ายรูป 4 มุม' },
    { id: '31_seller_list_step3', path: '/seller/list/step-3', label: 'ลงขาย Step 4: เช็กจุดตำหนิ 5 ข้อ' },
    { id: '32_seller_list_step4', path: '/seller/list/step-4', label: 'ลงขาย Step 5: ตั้งราคา & วิธีรับ' },
    { id: '33_seller_list_success', path: `/seller/list/success?id=${encodeURIComponent(ctx.bookId)}`, label: 'ลงขายสำเร็จ' },
    { id: '34_seller_listing_edit', path: `/seller/listings/${ctx.listingId}/edit`, label: 'แก้ไขประกาศขาย' },
    { id: '35_seller_report', path: '/seller/report', label: 'รายงานปัญหา' },
    { id: '36_seller_report_sent', path: '/seller/report/sent', label: 'ส่งรายงานปัญหาแล้ว' },
    { id: '37_admin', path: '/admin', label: 'แอดมินจัดการข้อพิพาท' },
    { id: '38_design_system', path: '/design-system', label: 'Design System' },
    { id: '39_line_preview', path: '/line-preview', label: 'LINE Flex Preview' },
    { id: '40_debug', path: '/debug', label: 'Debug Console' },
  ];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeReports(results, ctx) {
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const warnCount = results.filter((r) => r.status === 'WARN').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  const mdLines = [
    '# GongDong UI Snapshot Sweep Report',
    '',
    `- **Generated**: ${new Date().toISOString()}`,
    `- **Viewport**: 430×932 (mobile, fullPage)`,
    `- **Read-only Context IDs**: user=\`${ctx.realUserId}\`, book=\`${ctx.bookId}\`, seller=\`${ctx.sellerId}\`, order=\`${ctx.orderId}\``,
    `- **Summary**: **${passCount} PASS** · **${warnCount} WARN** · **${failCount} FAIL** (Total ${results.length} routes)`,
    '',
    '| # | Status | Route | Label | Issues | Screenshot |',
    '|---|---|---|---|---|---|',
  ];

  for (const r of results) {
    const issueSummary =
      [...r.failures.map((f) => `FAIL: ${f}`), ...r.warnings.map((w) => `WARN: ${w}`)].join(' ; ') ||
      '-';
    mdLines.push(
      `| ${r.index} | ${r.status} | \`${r.path}\` | ${r.label} | ${issueSummary.replace(/\|/g, '\\|')} | [png](screenshots/${r.screenshotName}) |`
    );
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), mdLines.join('\n'), 'utf8');

  const cardsHtml = results
    .map((r) => {
      const badgeColor =
        r.status === 'PASS'
          ? 'background:#dcfce7;color:#166534;border:1px solid #86efac;'
          : r.status === 'WARN'
            ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'
            : 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;';
      const detailsList = [
        ...r.failures.map((f) => `<li style="color:#b91c1c;"><strong>FAIL:</strong> ${escapeHtml(f)}</li>`),
        ...r.warnings.map((w) => `<li style="color:#b45309;"><strong>WARN:</strong> ${escapeHtml(w)}</li>`),
      ].join('');

      return `
      <div style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden;display:flex;flex-direction:column;">
        <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div style="font-weight:700;font-size:14px;color:#0f172a;">#${r.index} ${escapeHtml(r.label)}</div>
            <div style="font-family:monospace;font-size:12px;color:#64748b;margin-top:2px;">${escapeHtml(r.path)} (${r.durationMs}ms)</div>
          </div>
          <span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;${badgeColor}">${r.status}</span>
        </div>
        ${detailsList ? `<ul style="margin:0;padding:10px 14px 10px 28px;background:#f8fafc;border-bottom:1px solid #f1f5f9;font-size:12px;line-height:1.45;">${detailsList}</ul>` : ''}
        <a href="screenshots/${escapeHtml(r.screenshotName)}" target="_blank" style="display:block;background:#f1f5f9;padding:10px;text-align:center;">
          <img src="screenshots/${escapeHtml(r.screenshotName)}" alt="${escapeHtml(r.label)}" loading="lazy" style="max-width:100%;max-height:520px;object-fit:contain;border-radius:10px;border:1px solid #cbd5e1;" />
        </a>
      </div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>GongDong UI Snapshot Sweep Report</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px;">
  <div style="max-width:1400px;margin:0 auto;">
    <h1 style="margin:0 0 8px;">GongDong UI Snapshot Sweep</h1>
    <p style="color:#475569;margin:0 0 20px;font-size:14px;">
      Viewport 430×932 (fullPage) · <strong>${passCount} PASS</strong> · <strong>${warnCount} WARN</strong> · <strong>${failCount} FAIL</strong> (ทั้งหมด ${results.length} หน้า)
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
      ${cardsHtml}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.html'), html, 'utf8');
}

async function main() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log('[sweep] Discovering read-only DB IDs...');
  const ctx = await discoverReadOnlyIds();
  console.log('[sweep] Context:', ctx);

  const executablePath = resolveChromiumExecutable();
  console.log('[sweep] Using Chromium:', executablePath);

  const backend = spawnService(
    'backend',
    'node',
    ['dist/index.js'],
    BACKEND_DIR,
    {
      NODE_ENV: 'development',
      PORT: String(BACKEND_PORT),
      FRONTEND_URL: FRONTEND_URL,
    }
  );

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
  try {
    console.log(`[sweep] Waiting for backend (${BACKEND_URL}) and frontend (${FRONTEND_URL})...`);
    await waitForHttpReady(`${BACKEND_URL}/api/health`, 'backend', 45_000, backend);
    await waitForHttpReady(`${FRONTEND_URL}/`, 'frontend', 90_000, frontend);
    console.log('[sweep] Both servers are ready.');

    browser = await chromium.launch({
      executablePath,
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      locale: 'th-TH',
    });

    let activeRoutePath = '/';
    const fallbackOrder = buildFallbackOrderDetail(ctx);
    const fallbackAdminDispute = buildFallbackAdminDispute(ctx);

    await context.route('**/api/**', async (route) => {
      const request = route.request();
      const method = request.method().toUpperCase();
      const url = new URL(request.url());
      const pathname = url.pathname;

      // Read-only safety: never mutate DB during UI snapshot sweep
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

      // Admin endpoint fallback if local env has no ADMIN_LINE_USER_IDS or 0 disputes
      if (pathname.startsWith('/api/admin/orders')) {
        try {
          const resp = await route.fetch({ headers });
          if (resp.ok()) {
            const json = await resp.json().catch(() => null);
            if (json?.data?.orders?.length > 0) {
              return route.fulfill({ response: resp });
            }
          }
        } catch {
          // fallback below
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { orders: [fallbackAdminDispute] },
          }),
        });
      }

      // Mock order fallback if user has no real order in DB
      if (!ctx.hasRealOrderForUser && pathname === `/api/orders/${ctx.orderId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: fallbackOrder }),
        });
      }

      if (!ctx.hasRealOrderForUser && pathname === '/api/users/me/orders') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              buying: [{ id: fallbackOrder.id }],
              selling: [],
              details: [fallbackOrder],
            },
          }),
        });
      }

      // Pass GET through to real local backend with real existing user token
      const resp = await route.fetch({ headers });

      // Ensure /admin renders the admin UI instead of 403 when sweeping /admin
      if (pathname === '/api/users/me' && activeRoutePath === '/admin' && resp.ok()) {
        const json = await resp.json().catch(() => null);
        if (json?.data) {
          json.data.is_admin = true;
          return route.fulfill({
            status: resp.status(),
            headers: resp.headers(),
            body: JSON.stringify(json),
          });
        }
      }

      // Ensure /seller/listings/[id]/edit has a matching listing if the user owns 0 books
      if (
        !ctx.hasRealListingForUser &&
        pathname === '/api/users/me/books' &&
        resp.ok()
      ) {
        const json = await resp.json().catch(() => null);
        if (json?.data && Array.isArray(json.data.books) && json.data.books.length === 0) {
          json.data.books = [
            {
              id: ctx.listingId,
              title: 'หนังสือตัวอย่างสำหรับแก้ไขประกาศ',
              author: 'ผู้แต่งตัวอย่าง',
              price: 180,
              grade: 'GOOD',
              status: 'AVAILABLE',
              is_set: false,
              allow_pickup: true,
              allow_delivery: true,
              cover_image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
              created_at: new Date().toISOString(),
            },
          ];
          return route.fulfill({
            status: resp.status(),
            headers: resp.headers(),
            body: JSON.stringify(json),
          });
        }
      }

      return route.fulfill({ response: resp });
    });

    const page = await context.newPage();

    // Seed localStorage cart with one real book so /cart renders populated checkout UI
    await page.addInitScript(
      ({ userId, bookId, sellerId, sellerName }) => {
        try {
          const cartKey = `gongdong.cart.v2:${userId}`;
          if (!window.localStorage.getItem(cartKey)) {
            window.localStorage.setItem(
              cartKey,
              JSON.stringify({
                items: [
                  {
                    id: bookId,
                    title: 'หนังสือตัวอย่างในตะกร้า',
                    author: 'ผู้แต่งตัวอย่าง',
                    price: 180,
                    grade: 'GOOD',
                    images: [
                      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
                    ],
                    sellerId,
                    sellerName,
                    deliveryMethods: ['MEETUP', 'PARCEL'],
                    codEnabled: true,
                    status: 'AVAILABLE',
                  },
                ],
              })
            );
          }
        } catch {
          // ignore storage restrictions
        }
      },
      {
        userId: ctx.realUserId,
        bookId: ctx.bookId,
        sellerId: ctx.sellerId,
        sellerName: ctx.sellerName,
      }
    );

    const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
    const onlyIds = onlyArg
      ? new Set(
          onlyArg
            .slice('--only='.length)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      : null;

    const allRoutes = buildRouteList(ctx);
    const routes = onlyIds ? allRoutes.filter((r) => onlyIds.has(r.id)) : allRoutes;
    if (routes.length === 0) {
      throw new Error(`No matching routes for ${onlyArg}`);
    }
    const results = [];

    for (let i = 0; i < routes.length; i += 1) {
      const routeDef = routes[i];
      const index = String(i + 1).padStart(2, '0');
      const screenshotName = `${routeDef.id}.png`;
      const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);

      const failures = [];
      const warnings = [];
      activeRoutePath = routeDef.path.split('?')[0];

      const onPageError = (err) => {
        failures.push(`pageerror: ${err?.message || String(err)}`);
      };
      const onConsole = (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Ignore browser-emitted resource-status noise when we already track API responses
          if (!text.startsWith('Failed to load resource: the server responded with a status of 4')) {
            failures.push(`console.error: ${text}`);
          }
        }
      };
      const onResponse = (res) => {
        try {
          const u = new URL(res.url());
          if (!u.pathname.startsWith('/api/')) return;
          if (res.status() >= 500) {
            failures.push(`API ${res.status()} ${u.pathname}`);
          } else if (res.status() >= 400) {
            warnings.push(`API ${res.status()} ${u.pathname}`);
          }
        } catch {
          // ignore
        }
      };

      page.on('pageerror', onPageError);
      page.on('console', onConsole);
      page.on('response', onResponse);

      const started = Date.now();
      try {
        const response = await page.goto(`${FRONTEND_URL}${routeDef.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });

        if (!response) {
          failures.push('No HTTP response from Next.js');
        } else if (response.status() >= 500) {
          failures.push(`Page HTTP ${response.status()}`);
        } else if (response.status() >= 400) {
          warnings.push(`Page HTTP ${response.status()}`);
        }

        await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
        await page.waitForTimeout(550);

        if (routeDef.expectRedirectTo) {
          const landedPath = new URL(page.url()).pathname;
          if (landedPath !== routeDef.expectRedirectTo) {
            warnings.push(`Expected redirect to ${routeDef.expectRedirectTo}, landed on ${landedPath}`);
          }
        }

        const domCheck = await page.evaluate(() => {
          const bodyText = (document.body?.innerText || '').trim();
          const portal = document.querySelector('nextjs-portal');
          const portalShadow = portal?.shadowRoot;
          const hasNextErrorOverlay = Boolean(
            portalShadow?.querySelector(
              '[data-nextjs-dialog], [data-nextjs-dialog-overlay], [data-nextjs-toast][data-has-errors="true"]'
            ) ||
              (portalShadow?.textContent || '').includes('Unhandled Runtime Error') ||
              (portalShadow?.textContent || '').includes('Build Error')
          );
          const hasAppErrorText =
            bodyText.includes('Application error: a client-side exception has occurred') ||
            bodyText.includes('Unhandled Runtime Error');
          const brokenImages = Array.from(document.querySelectorAll('img'))
            .filter((img) => img.complete && img.naturalWidth === 0)
            .map((img) => img.getAttribute('src') || '(no src)');
          return {
            textLength: bodyText.length,
            hasNextErrorOverlay,
            hasAppErrorText,
            brokenImages,
          };
        });

        if (domCheck.textLength === 0) {
          failures.push('Blank page (body innerText is empty)');
        }
        if (domCheck.hasNextErrorOverlay || domCheck.hasAppErrorText) {
          failures.push('Next.js runtime/application error detected');
        }
        for (const src of domCheck.brokenImages) {
          warnings.push(`Broken image: ${src}`);
        }

        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (err) {
        failures.push(`Navigation exception: ${err instanceof Error ? err.message : String(err)}`);
        await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
      } finally {
        page.off('pageerror', onPageError);
        page.off('console', onConsole);
        page.off('response', onResponse);
      }

      const durationMs = Date.now() - started;
      const status = failures.length > 0 ? 'FAIL' : warnings.length > 0 ? 'WARN' : 'PASS';
      console.log(`[sweep] ${index}/${routes.length} [${status}] ${routeDef.path} (${durationMs}ms)`);
      if (failures.length > 0) console.log(`        FAIL -> ${failures.join(' | ')}`);
      if (warnings.length > 0) console.log(`        WARN -> ${warnings.join(' | ')}`);

      results.push({
        index,
        status,
        path: routeDef.path,
        label: routeDef.label,
        screenshotName,
        failures,
        warnings,
        durationMs,
      });
    }

    if (!onlyIds) {
      writeReports(results, ctx);
    }
    const failCount = results.filter((r) => r.status === 'FAIL').length;
    const warnCount = results.filter((r) => r.status === 'WARN').length;
    const passCount = results.filter((r) => r.status === 'PASS').length;

    console.log('');
    console.log(`[sweep] Complete: ${passCount} PASS, ${warnCount} WARN, ${failCount} FAIL (Total ${results.length})`);
    if (!onlyIds) {
      console.log(`[sweep] Report MD:   ${path.join(OUTPUT_DIR, 'report.md')}`);
      console.log(`[sweep] Report HTML: ${path.join(OUTPUT_DIR, 'report.html')}`);
    }

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    killProcessTree(frontend.child);
    killProcessTree(backend.child);
  }
}

main().catch((err) => {
  console.error('[sweep] Fatal error:', err);
  process.exit(1);
});
