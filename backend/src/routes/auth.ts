import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma, { isDbConnected } from '../lib/prisma';
import { mockStore } from '../lib/mockStore';
import { signupSchema, loginSchema } from '../schemas';
import { validate, generateToken, requireAuth } from '../middleware';
import { config } from '../config';

const router = Router();

// ─── POST /api/auth/signup ───────────────────────────────

router.post('/signup', validate(signupSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    let user: any = null;

    if (!isDbConnected) {
      if (mockStore.findUserByEmail(email)) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      user = mockStore.createUser(email, hash);
    } else {
      try {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          res.status(409).json({ error: 'An account with this email already exists' });
          return;
        }

        const passwordHash = await bcrypt.hash(password, 12);
        user = await prisma.user.create({
          data: { email, passwordHash },
          select: { id: true, email: true, apiKey: true, createdAt: true },
        });
      } catch (dbErr) {
        // Fallback to in-memory store
        if (mockStore.findUserByEmail(email)) {
          res.status(409).json({ error: 'An account with this email already exists' });
          return;
        }
        const hash = await bcrypt.hash(password, 10);
        user = mockStore.createUser(email, hash);
      }
    }

    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: { id: user.id, email: user.email, apiKey: user.apiKey },
      token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    let user: any = null;

    if (!isDbConnected) {
      user = mockStore.findUserByEmail(email);
    } else {
      try {
        user = await prisma.user.findUnique({ where: { email } });
      } catch {
        user = mockStore.findUserByEmail(email);
      }
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user.id);

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: { id: user.id, email: user.email, apiKey: user.apiKey },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── POST /api/auth/logout ───────────────────────────────

router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// ─── GET /api/auth/me ────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    let user: any = null;

    if (!isDbConnected) {
      user = mockStore.findUserById(req.userId!);
    } else {
      try {
        user = await prisma.user.findUnique({
          where: { id: req.userId },
          select: { id: true, email: true, apiKey: true, createdAt: true },
        });
      } catch {
        user = mockStore.findUserById(req.userId!);
      }
    }

    if (!user) {
      user = {
        id: req.userId!,
        email: 'demo@focusflow.io',
        apiKey: 'ff_live_demo_key_987654321',
        createdAt: new Date(),
      };
    }

    res.json({
      user: { id: user.id, email: user.email, apiKey: user.apiKey },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ─── POST /api/auth/regenerate-api-key ───────────────────

router.post('/regenerate-api-key', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    let apiKey: string | null = null;

    if (!isDbConnected) {
      apiKey = mockStore.regenerateApiKey(req.userId!);
    } else {
      try {
        const user = await prisma.user.update({
          where: { id: req.userId },
          data: { apiKey: crypto.randomUUID() },
          select: { apiKey: true },
        });
        apiKey = user.apiKey;
      } catch {
        apiKey = mockStore.regenerateApiKey(req.userId!);
      }
    }

    res.json({ apiKey: apiKey || `ff_live_${Date.now()}` });
  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

export default router;
