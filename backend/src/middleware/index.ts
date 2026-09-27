import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ZodSchema, ZodError } from 'zod';
import { config } from '../config';
import prisma from '../lib/prisma';

// ─── Extend Express Request ─────────────────────────────

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// ─── JWT Token Helpers ───────────────────────────────────

interface JwtPayload {
  userId: string;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

// ─── Auth Middleware ─────────────────────────────────────
// Supports: cookie (token), Bearer token header, API key header

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let userId: string | null = null;

    // 1. Check for Bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = verifyToken(token);
        userId = payload.userId;
      } catch {
        // Token invalid — fall through to other methods
      }
    }

    // 2. Check for token in cookies
    if (!userId && req.cookies?.token) {
      try {
        const payload = verifyToken(req.cookies.token);
        userId = payload.userId;
      } catch {
        // Cookie token invalid — fall through
      }
    }

    // 3. Check for API key in X-API-Key header
    if (!userId && req.headers['x-api-key']) {
      const apiKey = req.headers['x-api-key'] as string;
      try {
        const user = await prisma.user.findUnique({ where: { apiKey } });
        if (user) userId = user.id;
      } catch {
        // Fallback to mock store
        const { mockStore } = require('../lib/mockStore');
        const user = mockStore.findUserByApiKey(apiKey);
        if (user) userId = user.id;
      }
    }

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    req.userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// ─── Validation Middleware ───────────────────────────────

export function validate(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(source === 'body' ? req.body : req.query);
      if (source === 'body') {
        req.body = data;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}

// ─── Global Error Handler ────────────────────────────────

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err);

  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({ error: 'Database error', message: err.message });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
  });
}

// ─── Request Logger ──────────────────────────────────────

export function requestLogger(req: Request, _res: Response, next: NextFunction): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
}
