import express, { Request, Response } from 'express';
import type { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { notificationRouter } from './routes/notifications';
import { orderRouter } from './routes/orders';
import { bookRouter } from './routes/books';
import { sellerRouter, shopRouter } from './routes/seller';
import { uploadRouter } from './routes/upload';
import { userRouter } from './routes/users';
import { webhookRouter } from './routes/webhooks';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

const allowedOrigins = [
  ...env.FRONTEND_URL.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  ...(env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'https://localhost:3000']
    : []),
];

// Security Middlewares
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// LINE Webhook (ต้องมาก่อน express.json เพื่อตรวจ Raw Body Signature)
app.use('/api/webhooks', webhookRouter);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/orders', orderRouter);
app.use('/api/books', bookRouter);
app.use('/api/users', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/shops', shopRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/notifications', notificationRouter);

// Root Endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Welcome to GongDong Backend API Service (ตลาดหนังสือมือสองบน LINE)',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
      details: null,
    },
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server (ข้ามการเปิดพอร์ตเมื่อรันบน Vercel Serverless)
let server: Server | undefined;
if (!process.env.VERCEL) {
  server = app.listen(env.PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 GongDong API Service is running on port ${env.PORT}`);
    console.log(`📡 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 Health Check: http://localhost:${env.PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

export default app;
export { server };
