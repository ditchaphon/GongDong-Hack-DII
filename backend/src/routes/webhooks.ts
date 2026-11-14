import express, { Router, Request, Response, NextFunction } from 'express';
import { validateSignature } from '@line/bot-sdk';
import { env } from '../config/env';
import { handleLineWebhookEvents } from '../services/lineNotifyService';
import { AppError } from '../types';

export const webhookRouter = Router();

/**
 * POST /api/webhooks/line
 * รับ Event จาก LINE Messaging API (ต้อง mount ก่อน express.json() เพื่อตรวจ Raw Body Signature)
 */
webhookRouter.post(
  '/line',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

      if (env.LINE_CHANNEL_SECRET) {
        const signature = String(req.headers['x-line-signature'] || '');
        if (!signature || !validateSignature(rawBody, env.LINE_CHANNEL_SECRET, signature)) {
          throw new AppError('Invalid LINE webhook signature', 401, 'INVALID_LINE_SIGNATURE');
        }
      }

      const payload = rawBody ? JSON.parse(rawBody) : { events: [] };
      const events = Array.isArray(payload.events) ? payload.events : [];
      const result = await handleLineWebhookEvents(events);

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);
