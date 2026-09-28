import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { errorHandler, requestLogger } from './middleware';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import taskRoutes from './routes/tasks';
import reminderRoutes from './routes/reminders';
import aiRoutes from './routes/ai';

const app = express();

// ─── Global Middleware ───────────────────────────────────

app.use(cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    if (
      requestOrigin === config.frontendUrl ||
      requestOrigin === 'http://localhost:5173' ||
      requestOrigin === 'http://localhost:3000' ||
      /\.vercel\.app$/.test(requestOrigin) ||
      requestOrigin.startsWith('chrome-extension://')
    ) {
      return callback(null, true);
    }
    // Allow dynamically to prevent breaking deployment preview URLs
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'development' ? 10000 : 1000, // Generous limit in dev to avoid blocking active testing
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ─── Health Check ────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 Handler ─────────────────────────────────────────

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Route not found' });
    return;
  }
  res.status(404).send('Not found');
});

// ─── Global Error Handler ────────────────────────────────

app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║   🚀 FocusFlow API Server                   ║
║   Running on port ${config.port}                      ║
║   Environment: ${config.nodeEnv.padEnd(25)}║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
