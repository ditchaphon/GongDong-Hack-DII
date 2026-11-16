import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000,
    },
  });

// เก็บ instance ไว้บน global ทั้งใน dev (HMR) และ production (Vercel warm serverless)
global.prisma = prisma;
