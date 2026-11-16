import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function timingSafeMatches(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

export function getAdminLineUserIdSet(rawCsv?: string | null): Set<string> {
  if (!rawCsv) return new Set();
  return new Set(
    rawCsv
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

export function isAdminLineUserId(
  lineUserId?: string | null,
  rawCsv: string | undefined = process.env.ADMIN_LINE_USER_IDS
): boolean {
  if (!lineUserId) return false;
  const trimmed = lineUserId.trim();
  if (!trimmed) return false;
  return getAdminLineUserIdSet(rawCsv).has(trimmed);
}

/**
 * Shared fail-closed middleware factory for Admin API Key and Cron Secret endpoints.
 */
export function requireSecretMiddleware(options: {
  getExpectedSecret: () => string | undefined;
  headerName: string;
  missingCode: string;
  missingMessage: string;
  invalidMessage: string;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const expected = options.getExpectedSecret()?.trim();
    if (!expected) {
      next(new AppError(options.missingMessage, 503, options.missingCode));
      return;
    }

    const headerVal = req.header(options.headerName)?.trim();
    const authHeader = req.header('authorization')?.trim();
    const bearerToken =
      authHeader && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    const provided = headerVal || bearerToken;
    if (!provided || !timingSafeMatches(provided, expected)) {
      next(new AppError(options.invalidMessage, 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}
