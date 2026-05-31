import 'reflect-metadata';
import dotenv from 'dotenv';
dotenv.config();

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { useExpressServer } from 'routing-controllers';
import { useContainer } from 'routing-controllers';
import { setupOpenAPIDocs } from './config/openapi.js';
import { authorizationChecker, currentUserChecker } from './api/middlewares/authenticationCheckers.js';
import { errorHandlerMiddleware, initSentry } from './api/middlewares/errorHandlerMiddleware.js';
import { cspNonceMiddleware, helmetConfig } from './api/middlewares/helmetConfig.js';
import { otpSendLimiter as otpSendLimiterRedis } from './api/middlewares/rateLimiter.js';
import { serviceAuthMiddleware } from './api/middlewares/serviceAuthMiddleware.js';
import { requestContextMiddleware } from './api/middlewares/requestContextMiddleware.js';
import { auth } from './lib/auth.js';
import { toNodeHandler } from 'better-auth/node';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { eventsQueue } from './infrastructure/queue/eventsQueue.js';
import Container from './config/Containers/AppContainers.js';
import controllers from './api/controllers/index.js';
import { sanitizeMiddleware } from './api/middlewares/sanitizeMiddleware.js';
import { bruteForce, recordFailedAttempt, clearFailedAttempts } from './api/middlewares/bruteForceMiddleware.js';
import { adminTotpEnforcement } from './api/middlewares/totpEnforcement.js';

const app: Application = express();

// ── 0. Sentry — must be absolute first ────────────────────────────────────
initSentry(app);

// ── 1. CORS ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);                 // same-origin / curl
    if (origin === (process.env.FRONTEND_URL || "")) return cb(null, true);
    if (/^http:\/\/localhost:\d+$/.test(origin))    return cb(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── 2. CSP nonce (must run BEFORE helmetConfig reads res.locals.cspNonce) ──
app.use(cspNonceMiddleware);
app.use((req, res, next) => {
  // Disable CSP on docs routes only — nonce pipeline stays active everywhere else
  if (req.path.startsWith('/docs') || req.path.startsWith('/api/auth/reference')) {
    return next();
  }
  return helmetConfig()(req, res, next);
});

// ── 3. Body parsing — MUST come before sanitize middleware ─────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => { (req as any)._body = true; next(); });

// ── 4. Input sanitization (XSS defence-in-depth Layer 1) ──────────────────
//    Layer 2 is React/Next.js output encoding (JSX expression binding).
//    This runs after body parsing so req.body is populated.
app.use(sanitizeMiddleware);

// ── 5. Better Auth — brute force intercept ────────────────────────────────
app.post(
  '/api/auth/sign-in/email-otp',
  bruteForce,
  (req: Request, res: Response, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      const email = (req.body?.email ?? '').toLowerCase().trim();
      if (res.statusCode >= 400) {
        recordFailedAttempt(req, email).catch(() => {});
      } else {
        clearFailedAttempts(req, email).catch(() => {});
      }
      return originalJson(body);
    };
    next();
  },
);

app.post('/api/auth/email-otp/send-verification-otp', otpSendLimiterRedis);
app.use('/api/auth', (req, res) => toNodeHandler(auth)(req, res));

// ── 6. Request context + logging ──────────────────────────────────────────
app.use('/api/admin', adminTotpEnforcement);
app.use(requestContextMiddleware);
app.use(morgan('combined'));

const port: number = parseInt(process.env.PORT || '3000');

useContainer(Container);

import { EventRegistry } from './infrastructure/events/EventRegistry.js';
Container.get(EventRegistry).initialize();

// ── 7. Routing controllers ─────────────────────────────────────────────────
useExpressServer(app, {
  routePrefix: '/api',
  controllers,
  validation: true,
  classTransformer: true,
  defaultErrorHandler: false,
  authorizationChecker,
  currentUserChecker,
});

// ── 8. BullMQ dashboard ────────────────────────────────────────────────────
if (eventsQueue) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(eventsQueue)], serverAdapter });
  app.use('/admin/queues', (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="BullMQ Dashboard"');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
  if (user !== 'admin' || pass !== (process.env.RAG_SERVICE_TOKEN ?? '')) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}, serverAdapter.getRouter());
}

// ── 9. OpenAPI docs ────────────────────────────────────────────────────────
try {
  setupOpenAPIDocs(app);
} catch (err) {
  console.warn('⚠  OpenAPI doc generation failed (non-fatal):', (err as Error).message);
}

// ── 10. RAG auto-sync on product mutations ─────────────────────────────────
const RAG_SERVICE_URL = process.env.RAG_URL || 'http://localhost:8001';
app.use('/api/products', (req: Request, _res: Response, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    _res.on('finish', () => {
      if (_res.statusCode < 400) {
        import('axios').then(({ default: ax }) => {
          ax.post(`${RAG_SERVICE_URL}/sync`, {}, {
            timeout: 120_000,
            headers: { Authorization: `Bearer ${process.env.RAG_SERVICE_TOKEN ?? ''}` },
          })
            .then(() => console.log('[RAG] Auto-sync triggered'))
            .catch((e: Error) => console.warn('[RAG] Auto-sync failed:', e.message));
        });
      }
    });
  }
  next();
});

// ── 11. Error handler — must be last ──────────────────────────────────────
app.use(errorHandlerMiddleware);

app.get('/', (req: Request, res: Response) => {
  res.send(`Hello from ${process.env.APP_NAME} v${process.env.APP_VERSION}! API docs at /docs`);
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
    console.log(`📚 API documentation available at http://localhost:${port}/docs`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Error: Port ${port} is already in use.`);
      process.exit(1);
    } else {
      console.error(`An error occurred while starting the server:`, error);
      process.exit(1);
    }
  });
}







