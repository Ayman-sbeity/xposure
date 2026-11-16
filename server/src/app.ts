// The web application: security headers, the API, uploaded images, the admin panel and the
// website, in that order. Kept separate from index.ts so tests can start it on any port.
import type { Server } from 'node:http';
import path from 'node:path';
import compression from 'compression';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import type { Db } from './db.ts';
import { adminRoutes } from './routes/admin.ts';
import { publicRoutes } from './routes/public.ts';
import { createSite } from './site.ts';

export async function createApp(options: { db: Db; production: boolean; dataDir: string; httpServer?: Server }) {
  const { db, production, dataDir } = options;
  const https = Boolean(config.publicOrigin?.startsWith('https://'));
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      // Development uses Vite's inline hot-reload scripts, so the policy applies in production only.
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", 'https://www.googletagmanager.com'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https://www.googletagmanager.com', 'https://*.google-analytics.com'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'", 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com'],
              frameAncestors: ["'none'"],
              formAction: ["'self'"],
              baseUri: ["'self'"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: https ? [] : null,
            },
          }
        : false,
      strictTransportSecurity: https ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    next();
  });
  app.use(compression());

  const site = await createSite({ db, production, httpServer: options.httpServer });

  app.use('/api/admin', express.json({ limit: '2mb' }), adminRoutes(db, site, dataDir));
  app.use('/api', express.json({ limit: '32kb' }), publicRoutes(db, site));
  app.use('/api', (_req, res) => void res.status(404).json({ error: 'Not found.' }));

  // Images uploaded in the admin panel. Names are random and never reused, so cache for long.
  app.use(
    '/uploads',
    express.static(path.join(dataDir, 'uploads'), {
      index: false,
      fallthrough: false,
      immutable: true,
      maxAge: '365d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  site.mount(app);

  // Errors: short JSON for the API, a plain message for pages. Details stay in the server log.
  app.use((error: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) => {
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : error.status && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(`${req.method} ${req.originalUrl} failed:`, error);
    const message = status === 413 ? 'That is too large.' : status === 400 ? 'The request could not be read.' : status === 404 ? 'Not found.' : 'Something went wrong. Please try again.';
    if (req.originalUrl.startsWith('/api/')) return void res.status(status).json({ error: message });
    res.status(status).type('text/plain').send(message);
  });

  return { app, site };
}
