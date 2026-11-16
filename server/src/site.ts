// Serves the public website: every page is rendered on the server with the content saved in
// the admin panel (so search engines get full HTML), then hydrated in the browser.
// In development Vite compiles on the fly (with instant reload); in production the built
// files in dist/ and .ssr/ are used and rendered pages are cached until content changes.
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { ViteDevServer } from 'vite';
import { ROOT } from './config.ts';
import type { Db } from './db.ts';

// What client/entry-server.tsx exports.
export type MediaItem = { key: string; src: string; width: number; height: number; alt: string; altAr: string };
export type SsrModule = {
  render(path: string): { html: string; head: string; lang: string; dir: string; status: number };
  setRuntime(options: { api: boolean }): void;
  content: {
    listSections(): { id: string; title: string; description: string; viewPath: string }[];
    describeSection(id: string, saved: unknown): Record<string, unknown>;
    validateSection(id: string, doc: unknown): string[];
    isSectionId(id: string): boolean;
    apply(overrides: Record<string, unknown>): void;
    registerMedia(items: MediaItem[]): void;
    listImages(): MediaItem[];
  };
  business(): { name: string; email: string; phone: string; phoneDisplay: string; whatsappNumber: string; url: string; indexable: boolean; arabicReviewed: boolean };
  redirectRules: { exact: [string, string][]; fallbacks: [string, string][] };
  robotsTxt(): string;
  sitemap(): string;
};

const HEAD = '<!--app-head-->';
const ROOT_ELEMENT = '<div id="root"></div>';
const HTML_TAG = '<html lang="en">';

/** Script-safe JSON for a <script type="application/json"> data block. */
const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export type SiteHandle = Awaited<ReturnType<typeof createSite>>;

export async function createSite(options: { db: Db; production: boolean; httpServer?: Server }) {
  const { db, production } = options;
  let vite: ViteDevServer | undefined;
  let productionModule: SsrModule | undefined;
  let template = '';
  let adminTemplate = '';

  if (production) {
    template = await fs.readFile(path.join(ROOT, '.ssr', 'template.html'), 'utf8');
    adminTemplate = await fs.readFile(path.join(ROOT, 'dist', 'admin.html'), 'utf8');
  } else {
    const { createServer } = await import('vite');
    vite = await createServer({
      root: ROOT,
      appType: 'custom',
      server: { middlewareMode: true, hmr: options.httpServer ? { server: options.httpServer } : false },
    });
  }

  // ---- Content state ------------------------------------------------------
  let overrides: Record<string, unknown> = {};
  let media: MediaItem[] = [];
  let version = 0;
  let appliedTo: SsrModule | undefined;
  let appliedVersion = -1;
  const pageCache = new Map<string, { status: number; html: string }>();

  function reload(): void {
    overrides = Object.fromEntries(
      (db.prepare('SELECT section, doc FROM content').all() as { section: string; doc: string }[]).map((row) => [row.section, JSON.parse(row.doc)]),
    );
    media = (db.prepare('SELECT key, file, width, height, alt, alt_ar FROM media ORDER BY id').all() as Record<string, string & number>[]).map((row) => ({
      key: String(row.key),
      src: `/uploads/${row.file}`,
      width: Number(row.width),
      height: Number(row.height),
      alt: String(row.alt),
      altAr: String(row.alt_ar),
    }));
    version += 1;
    pageCache.clear();
  }
  reload();

  async function ssr(): Promise<SsrModule> {
    const module = production
      ? (productionModule ??= (await import(pathToFileURL(path.join(ROOT, '.ssr', 'entry-server.js')).href)) as SsrModule)
      : ((await vite!.ssrLoadModule('/client/entry-server.tsx')) as SsrModule);
    // Apply the saved content once per change (and again whenever Vite reloads the module).
    if (module !== appliedTo || appliedVersion !== version) {
      module.setRuntime({ api: true });
      module.content.registerMedia(media);
      module.content.apply(overrides);
      appliedTo = module;
      appliedVersion = version;
    }
    return module;
  }

  async function renderPage(url: string): Promise<{ status: number; html: string }> {
    const pathname = new URL(url, 'http://local').pathname;
    const cached = production ? pageCache.get(pathname) : undefined;
    if (cached) return cached;
    const module = await ssr();
    const base = production ? template : await vite!.transformIndexHtml(url, await fs.readFile(path.join(ROOT, 'index.html'), 'utf8'));
    const { html, head, lang, dir, status } = module.render(pathname);
    const data = `<script type="application/json" id="xp-data">${safeJson({ api: true, content: overrides, media })}</script>`;
    const page = base
      .replace(HTML_TAG, () => `<html lang="${lang}" dir="${dir}">`)
      .replace(/<title>[^<]*<\/title>\s*/, '')
      .replace(HEAD, () => `${head}\n${data}`)
      .replace(ROOT_ELEMENT, () => `<div id="root">${html}</div>`);
    const result = { status, html: page };
    if (production) pageCache.set(pathname, result);
    return result;
  }

  async function adminPage(url: string): Promise<string> {
    if (production) return adminTemplate;
    return vite!.transformIndexHtml(url, await fs.readFile(path.join(ROOT, 'admin.html'), 'utf8'));
  }

  /** Static files, then the admin app, then every website page. Mount after the API. */
  function mount(app: Express): void {
    if (vite) app.use(vite.middlewares);
    else {
      app.use(
        express.static(path.join(ROOT, 'dist'), {
          index: false,
          redirect: false,
          setHeaders(res, file) {
            const rel = path.relative(path.join(ROOT, 'dist'), file).replace(/\\/g, '/');
            if (rel.startsWith('static/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            else if (rel.startsWith('assets/')) res.setHeader('Cache-Control', 'public, max-age=604800');
            else res.setHeader('Cache-Control', 'public, max-age=3600');
          },
        }),
      );
    }

    app.get(['/admin', '/admin/{*rest}'], async (req, res, next) => {
      try {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.setHeader('Cache-Control', 'no-store');
        res.type('html').send(await adminPage(req.originalUrl));
      } catch (error) {
        next(error);
      }
    });

    app.get('/robots.txt', async (_req, res, next) => {
      try {
        res.type('text/plain').send((await ssr()).robotsTxt());
      } catch (error) {
        next(error);
      }
    });
    app.get('/sitemap.xml', async (_req, res, next) => {
      try {
        res.type('application/xml').send((await ssr()).sitemap());
      } catch (error) {
        next(error);
      }
    });

    app.use(async (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      try {
        const module = await ssr();
        const { pathname, search } = new URL(req.originalUrl, 'http://local');
        // Old WordPress addresses -> new pages.
        const target = redirectFor(module, pathname);
        if (target) return res.redirect(301, target);
        // Built page files and host config are not served directly.
        if (pathname.endsWith('.html') || pathname.startsWith('/_')) return res.redirect(301, pathname.replace(/(index)?\.html$/, '').replace(/^\/_.*/, '/') || '/');
        // One address per page: /about -> /about/
        if (!pathname.endsWith('/') && !path.extname(pathname)) return res.redirect(301, `${pathname}/${search}`);
        if (path.extname(pathname)) return next(); // a missing file: plain 404

        const info = module.business();
        if (!info.indexable) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        else if (!info.arabicReviewed && (pathname === '/ar/' || pathname.startsWith('/ar/'))) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        const page = await renderPage(req.originalUrl);
        res.setHeader('Cache-Control', 'no-cache');
        res.status(page.status).type('html').send(page.html);
      } catch (error) {
        if (vite && error instanceof Error) vite.ssrFixStacktrace(error);
        next(error);
      }
    });
  }

  return {
    ssr,
    mount,
    /** Call after content or media changes: pages re-render with the new content. */
    reload,
    async close() {
      await vite?.close();
    },
  };
}

function redirectFor(module: SsrModule, pathname: string): string | undefined {
  for (const [from, to] of module.redirectRules.exact) {
    if (pathname === from || pathname === (from.endsWith('/') ? from.slice(0, -1) : `${from}/`)) return to;
  }
  for (const [from, to] of module.redirectRules.fallbacks) {
    if (from.endsWith('*') && pathname.startsWith(from.slice(0, -1))) return to;
  }
  return undefined;
}
