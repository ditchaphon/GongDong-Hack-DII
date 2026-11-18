import dotenv from 'dotenv';
import { z } from 'zod';

// โหลดตัวแปรจากไฟล์ .env
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('8000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),

  // Supabase Storage
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // LINE
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_LOGIN_CHANNEL_ID: z.string().optional(),
  LINE_LIFF_CHANNEL_ID: z.string().optional(),
  // LIFF app id (e.g. 2012563845-xxxx) for deep links in LINE notification cards
  LINE_LIFF_ID: z.string().optional(),

  // SlipOK & Platform PromptPay
  SLIPOK_API_KEY: z.string().optional(),
  SLIPOK_BRANCH_ID: z.string().optional(),
  PLATFORM_PROMPTPAY_ID: z.string().optional(),
  PLATFORM_RECIPIENT_NAME: z.string().default('กองดอง · บัญชีรับชำระ'),
  PLATFORM_SLIP_RECEIVER_NAME: z.string().optional(),

  // Security & KYC Hashing & Blacklist Check
  ENABLE_MOCK_AUTH: z.string().optional(),
  KYC_HASH_PEPPER: z.string().optional(),
  BLACKLISTSELLER_API_KEY: z.string().optional(),
  BLACKLISTSELLER_API_URL: z
    .string()
    .default('https://api.blacklistseller.com/api/v1/queries/idcard-summary/'),

  // Google Books API (optional: reduces HTTP 429 rate-limit hits)
  GOOGLE_BOOKS_API_KEY: z.string().optional(),

  // Admin & Scheduled Cron Secrets
  ADMIN_API_KEY: z.string().optional(),
  ADMIN_LINE_USER_IDS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
