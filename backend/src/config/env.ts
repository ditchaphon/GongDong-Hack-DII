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

  // SlipOK
  SLIPOK_API_KEY: z.string().optional(),
  SLIPOK_BRANCH_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);
