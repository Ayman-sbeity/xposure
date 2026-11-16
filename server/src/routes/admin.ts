// API for the admin panel (/admin). Everything except sign-in needs a signed-in admin, and
// every change must come from the admin panel itself (see sameOriginOnly in auth.ts).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express, { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  dummyPasswordHash,
  endSession,
  requireAdmin,
  sameOriginOnly,
  setPassword,
  startSession,
  verifyPassword,
  type Admin,
} from '../auth.ts';
import { availableSlots, bookingSettings, meetingIcs, saveBookingSettings, zonedDate, zonedToUtc } from '../booking.ts';
import { logActivity, now, transaction, type Db, type Row } from '../db.ts';
import { inspectImage, toCsv } from '../files.ts';
import {
  accountSchema,
  bookingSettingsSchema,
  contentSchema,
  fieldErrors,
  loginSchema,
  meetingPatchSchema,
  MESSAGE_STATUSES,
  mediaPatchSchema,
  messagePatchSchema,
  passwordSchema,
} from '../schemas.ts';
import type { SiteHandle } from '../site.ts';
import { createZoomMeeting, deleteZoomMeeting, testZoom, zoomConfigured } from '../zoom.ts';

const HISTORY_KEEP = 30;
const MESSAGE_TYPES = ['enquiry', 'brief', 'application'];

const idParam = (req: Request) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const admin = (res: Response) => res.locals.admin as Admin;
const parseDetails = <T extends Row>(row: T) => ({ ...row, details: JSON.parse(String(row.details ?? '{}')) });

export function adminRoutes(db: Db, site: SiteHandle, dataDir: string): Router {
  const router = Router();
  const uploads = path.join(dataDir, 'uploads');
  router.use(sameOriginOnly);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ---------------------------------------------------------------- sign in
  // Only failed attempts count, so the team is never locked out by normal use.
  const signInLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' },
  });

  router.post('/login', signInLimit, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Enter your email and password.' });
    const email = parsed.data.email.toLowerCase();
    const row = db.prepare('SELECT id, email, name, password_hash FROM admins WHERE email = ?').get(email) as (Admin & { password_hash: string }) | undefined;
    // Always do the same work, so timing does not reveal whether the email exists.
    const valid = row ? await verifyPassword(parsed.data.password, row.password_hash) : (await verifyPassword(parsed.data.password, await dummyPasswordHash()), false);
    if (!row || !valid) {
      logActivity(db, null, 'Failed sign-in', email.slice(0, 120));
      return void res.status(401).json({ error: 'The email or password is not correct.' });
    }
    startSession(db, row.id, req, res);
    logActivity(db, row.id, 'Signed in');
    res.json({ admin: { id: row.id, email: row.email, name: row.name } });
  });

  router.post('/logout', (req, res) => {
    endSession(db, req, res);
    res.json({ ok: true });
  });

  router.use(requireAdmin(db));

  router.get('/me', (_req, res) => res.json({ admin: admin(res), zoom: zoomConfigured(), timezone: bookingSettings(db).timezone }));

  // ---------------------------------------------------------------- dashboard
  router.get('/stats', (_req, res) => {
    const { timezone } = bookingSettings(db);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const count = (sql: string, ...params: (string | number)[]) => Number((db.prepare(sql).get(...params) as { n: number }).n);

    const month = zonedDate(nowMs, timezone).slice(0, 7);
    const [year, monthNumber] = month.split('-').map(Number);
    const previous = monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
    const thisMonth = new Date(zonedToUtc(`${month}-01`, '00:00', timezone)).toISOString();
    const lastMonth = new Date(zonedToUtc(`${previous}-01`, '00:00', timezone)).toISOString();
    const leads = (from: string, to: string) =>
      count('SELECT COUNT(*) AS n FROM messages WHERE created_at >= ? AND created_at < ? AND status != ?', from, to, 'spam') +
      count('SELECT COUNT(*) AS n FROM meetings WHERE created_at >= ? AND created_at < ?', from, to);

    // Leads per day for the last 30 days, by kind.
    const since = new Date(nowMs - 29 * 864e5);
    const sinceIso = new Date(zonedToUtc(zonedDate(since.getTime(), timezone), '00:00', timezone)).toISOString();
    const days = new Map<string, Record<string, number>>();
    for (let i = 0; i < 30; i++) days.set(zonedDate(since.getTime() + i * 864e5, timezone), { enquiry: 0, brief: 0, application: 0, meeting: 0 });
    const bump = (iso: string, kind: string) => {
      const bucket = days.get(zonedDate(Date.parse(iso), timezone));
      if (bucket) bucket[kind] = (bucket[kind] ?? 0) + 1;
    };
    for (const row of db.prepare("SELECT type, created_at FROM messages WHERE created_at >= ? AND status != 'spam'").all(sinceIso) as { type: string; created_at: string }[]) bump(row.created_at, row.type);
    for (const row of db.prepare('SELECT created_at FROM meetings WHERE created_at >= ?').all(sinceIso) as { created_at: string }[]) bump(row.created_at, 'meeting');

    // Where leads came from (campaign links) and what they asked for, last 90 days.
    const since90 = new Date(nowMs - 90 * 864e5).toISOString();
    const sources = new Map<string, number>();
    for (const row of db.prepare("SELECT campaign FROM messages WHERE created_at >= ? AND status != 'spam' UNION ALL SELECT campaign FROM meetings WHERE created_at >= ?").all(since90, since90) as { campaign: string }[]) {
      const key = row.campaign.split(' / ')[0] || 'Direct or unknown';
      sources.set(key, (sources.get(key) ?? 0) + 1);
    }
    const services = new Map<string, number>();
    for (const row of db.prepare("SELECT service FROM messages WHERE type IN ('enquiry', 'brief') AND created_at >= ? AND status != 'spam'").all(since90) as { service: string }[]) {
      for (const name of row.service.split(', ').filter(Boolean)) services.set(name, (services.get(name) ?? 0) + 1);
    }
    const top = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    res.json({
      timezone,
      newMessages: count("SELECT COUNT(*) AS n FROM messages WHERE status = 'new'"),
      pendingMeetings: count("SELECT COUNT(*) AS n FROM meetings WHERE status = 'pending' AND end_at >= ?", nowIso),
      upcomingMeetings: count("SELECT COUNT(*) AS n FROM meetings WHERE status = 'confirmed' AND end_at >= ?", nowIso),
      leadsThisMonth: leads(thisMonth, nowIso),
      leadsLastMonth: leads(lastMonth, thisMonth),
      daily: [...days].map(([date, kinds]) => ({ date, ...kinds })),
      sources: top(sources),
      services: top(services),
      nextMeetings: db
        .prepare("SELECT id, status, start_at, end_at, name, company, topic FROM meetings WHERE status IN ('pending', 'confirmed') AND end_at >= ? ORDER BY start_at LIMIT 5")
        .all(nowIso),
      recentMessages: db.prepare("SELECT id, type, status, name, subject, created_at FROM messages WHERE status != 'spam' ORDER BY created_at DESC LIMIT 6").all(),
    });
  });

  // ---------------------------------------------------------------- messages
  router.get('/messages', (req, res) => {
    const status = String(req.query.status ?? 'inbox');
    const type = String(req.query.type ?? '');
    const q = String(req.query.q ?? '').trim().slice(0, 100);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where: string[] = [];
    const params: string[] = [];
    if (status === 'inbox') where.push("status IN ('new', 'read', 'replied')");
    else if ((MESSAGE_STATUSES as readonly string[]).includes(status)) (where.push('status = ?'), params.push(status));
    if (MESSAGE_TYPES.includes(type)) (where.push('type = ?'), params.push(type));
    if (q) {
      where.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')");
      params.push(...Array(6).fill(like(q)));
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const items = db
      .prepare(`SELECT id, type, status, name, email, phone, company, subject, substr(body, 1, 160) AS preview, channel, campaign, created_at FROM messages ${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset);
    const total = Number((db.prepare(`SELECT COUNT(*) AS n FROM messages ${filter}`).get(...params) as { n: number }).n);
    const counts: Record<string, number> = { inbox: 0, new: 0, read: 0, replied: 0, archived: 0, spam: 0 };
    for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM messages GROUP BY status').all() as { status: string; n: number }[]) counts[row.status] = Number(row.n);
    counts.inbox = counts.new + counts.read + counts.replied;
    res.json({ items, total, counts });
  });

  router.get('/export/messages.csv', (_req, res) => {
    const rows = db.prepare('SELECT * FROM messages ORDER BY created_at DESC').all() as Row[];
    const csv = toCsv(
      rows.map((row) => ({ ...row, details: Object.entries(JSON.parse(String(row.details))).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ') })),
      [
        ['created_at', 'Received (UTC)'],
        ['type', 'Type'],
        ['status', 'Status'],
        ['name', 'Name'],
        ['email', 'Email'],
        ['phone', 'Phone'],
        ['company', 'Company'],
        ['service', 'Service / role'],
        ['subject', 'Subject'],
        ['body', 'Message'],
        ['details', 'Details'],
        ['channel', 'Sent via'],
        ['campaign', 'Campaign'],
        ['page', 'Page'],
        ['note', 'Internal note'],
      ],
    );
    logActivity(db, admin(res).id, 'Exported messages', `${rows.length} rows`);
    res.setHeader('Content-Disposition', `attachment; filename="xposure-messages-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv; charset=utf-8').send(csv);
  });

  router.get('/messages/:id', (req, res) => {
    const id = idParam(req);
    const row = id && (db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row | undefined);
    if (!row) return void res.status(404).json({ error: 'This message no longer exists.' });
    // Opening a new message marks it as read.
    if (row.status === 'new') {
      db.prepare("UPDATE messages SET status = 'read', updated_at = ? WHERE id = ?").run(now(), id);
      row.status = 'read';
    }
    res.json({ message: parseDetails(row) });
  });

  router.patch('/messages/:id', (req, res) => {
    const id = idParam(req);
    const parsed = messagePatchSchema.safeParse(req.body);
    if (!id || !parsed.success) return void res.status(400).json({ error: 'Invalid change.' });
    const row = db.prepare('SELECT id, subject, status FROM messages WHERE id = ?').get(id) as Row | undefined;
    if (!row) return void res.status(404).json({ error: 'This message no longer exists.' });
    const { status, note } = parsed.data;
    if (status) db.prepare('UPDATE messages SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), id);
    if (note !== undefined) db.prepare('UPDATE messages SET note = ?, updated_at = ? WHERE id = ?').run(note, now(), id);
    if (status && status !== row.status) logActivity(db, admin(res).id, `Marked message as ${status}`, String(row.subject));
    res.json({ message: parseDetails(db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as Row) });
  });

  router.delete('/messages/:id', (req, res) => {
    const id = idParam(req);
    const row = id && (db.prepare('SELECT subject FROM messages WHERE id = ?').get(id) as Row | undefined);
    if (!row) return void res.status(404).json({ error: 'This message no longer exists.' });
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    logActivity(db, admin(res).id, 'Deleted message', String(row.subject));
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- meetings
  router.get('/meetings', (req, res) => {
    const view = String(req.query.view ?? 'upcoming');
    const nowIso = now();
    const sql: Record<string, [string, string[]]> = {
      upcoming: ["WHERE status IN ('pending', 'confirmed') AND end_at >= ? ORDER BY start_at", [nowIso]],
      pending: ["WHERE status = 'pending' AND end_at >= ? ORDER BY start_at", [nowIso]],
      past: ["WHERE end_at < ? OR status IN ('completed', 'cancelled') ORDER BY start_at DESC", [nowIso]],
      all: ['ORDER BY start_at DESC', []],
    };
    const [clause, params] = sql[view] ?? sql.upcoming;
    const settings = bookingSettings(db);
    res.json({
      items: db.prepare(`SELECT * FROM meetings ${clause} LIMIT 300`).all(...params),
      counts: {
        pending: Number((db.prepare("SELECT COUNT(*) AS n FROM meetings WHERE status = 'pending' AND end_at >= ?").get(nowIso) as { n: number }).n),
        upcoming: Number((db.prepare("SELECT COUNT(*) AS n FROM meetings WHERE status IN ('pending', 'confirmed') AND end_at >= ?").get(nowIso) as { n: number }).n),
      },
      timezone: settings.timezone,
      durationMinutes: settings.durationMinutes,
      zoom: zoomConfigured(),
    });
  });

  router.patch('/meetings/:id', async (req, res, next) => {
    try {
      const id = idParam(req);
      const parsed = meetingPatchSchema.safeParse(req.body);
      if (!id || !parsed.success) return void res.status(400).json({ error: parsed.success ? 'Invalid meeting.' : Object.values(fieldErrors(parsed.error)).flat()[0] ?? 'Invalid change.' });
      const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Row | undefined;
      if (!row) return void res.status(404).json({ error: 'This meeting no longer exists.' });
      const { status, joinUrl, note } = parsed.data;
      if (status === 'confirmed' && !(joinUrl ?? row.join_url)) return void res.status(400).json({ error: 'Add the meeting link before confirming.' });
      if (status === 'cancelled' && row.zoom_meeting_id && zoomConfigured()) {
        await deleteZoomMeeting(String(row.zoom_meeting_id)).catch((error) => console.error('Zoom cancel failed:', error instanceof Error ? error.message : error));
      }
      const stamp = now();
      if (status) db.prepare('UPDATE meetings SET status = ?, updated_at = ? WHERE id = ?').run(status, stamp, id);
      if (joinUrl !== undefined) db.prepare('UPDATE meetings SET join_url = ?, updated_at = ? WHERE id = ?').run(joinUrl, stamp, id);
      if (note !== undefined) db.prepare('UPDATE meetings SET note = ?, updated_at = ? WHERE id = ?').run(note, stamp, id);
      if (status && status !== row.status) logActivity(db, admin(res).id, `Meeting ${status}`, `${row.name} — ${row.start_at}`);
      res.json({ meeting: db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/meetings/:id/zoom', async (req, res) => {
    const id = idParam(req);
    const row = id && (db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Row | undefined);
    if (!row) return void res.status(404).json({ error: 'This meeting no longer exists.' });
    if (!zoomConfigured()) return void res.status(400).json({ error: 'Zoom is not connected. Add the Zoom settings, or paste a meeting link.' });
    try {
      const settings = bookingSettings(db);
      const business = (await site.ssr()).business();
      const minutes = Math.round((Date.parse(String(row.end_at)) - Date.parse(String(row.start_at))) / 60_000);
      const zoom = await createZoomMeeting({ topic: `${business.name} — ${row.name}`, startIso: String(row.start_at), durationMinutes: minutes, timezone: settings.timezone, agenda: String(row.message) });
      db.prepare("UPDATE meetings SET join_url = ?, zoom_meeting_id = ?, status = 'confirmed', updated_at = ? WHERE id = ?").run(zoom.joinUrl, zoom.id, now(), id);
      logActivity(db, admin(res).id, 'Created Zoom meeting', String(row.name));
      res.json({ meeting: db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Zoom could not create the meeting.' });
    }
  });

  router.get('/meetings/:id/ics', async (req, res) => {
    const id = idParam(req);
    const row = id && (db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as Row | undefined);
    if (!row) return void res.status(404).json({ error: 'This meeting no longer exists.' });
    const business = (await site.ssr()).business();
    res.setHeader('Content-Disposition', `attachment; filename="xposure-meeting-${id}.ics"`);
    res.type('text/calendar; charset=utf-8').send(meetingIcs(row as Parameters<typeof meetingIcs>[0], business));
  });

  router.get('/booking-settings', (_req, res) => {
    const settings = bookingSettings(db);
    res.json({ settings, zoom: zoomConfigured(), preview: availableSlots(db, settings).slice(0, 3) });
  });

  router.put('/booking-settings', (req, res) => {
    const parsed = bookingSettingsSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: Object.values(fieldErrors(parsed.error)).flat()[0] ?? 'Please check the availability settings.' });
    saveBookingSettings(db, parsed.data);
    logActivity(db, admin(res).id, 'Updated meeting availability');
    res.json({ settings: parsed.data, preview: availableSlots(db, parsed.data).slice(0, 3) });
  });

  // ---------------------------------------------------------------- content
  const savedRow = (section: string) => db.prepare('SELECT doc FROM content WHERE section = ?').get(section) as { doc: string } | undefined;

  router.get('/content', async (_req, res) => {
    const module = await site.ssr();
    const saved = new Map(
      (db.prepare('SELECT c.section, c.updated_at, a.name AS updated_by FROM content c LEFT JOIN admins a ON a.id = c.updated_by').all() as Row[]).map((row) => [row.section, row]),
    );
    res.json({
      sections: module.content.listSections().map((section) => ({
        ...section,
        customized: saved.has(section.id),
        updatedAt: saved.get(section.id)?.updated_at ?? null,
        updatedBy: saved.get(section.id)?.updated_by ?? null,
      })),
    });
  });

  router.get('/content/:section', async (req, res) => {
    const module = await site.ssr();
    const section = String(req.params.section);
    if (!module.content.isSectionId(section)) return void res.status(404).json({ error: 'Unknown section.' });
    const row = savedRow(section);
    res.json(module.content.describeSection(section, row ? JSON.parse(row.doc) : undefined));
  });

  /** Save a section (keeping the previous version in the history) and publish it. */
  function saveSection(section: string, doc: unknown, adminId: number, action: string): void {
    transaction(db, () => {
      const previous = savedRow(section);
      db.prepare('INSERT INTO content_history (section, doc, saved_at, saved_by) VALUES (?, ?, ?, ?)').run(section, previous?.doc ?? null, now(), adminId);
      if (doc === null) db.prepare('DELETE FROM content WHERE section = ?').run(section);
      else
        db.prepare('INSERT INTO content (section, doc, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(section) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at, updated_by = excluded.updated_by').run(
          section,
          JSON.stringify(doc),
          now(),
          adminId,
        );
      db.prepare('DELETE FROM content_history WHERE section = ? AND id NOT IN (SELECT id FROM content_history WHERE section = ? ORDER BY id DESC LIMIT ?)').run(section, section, HISTORY_KEEP);
      logActivity(db, adminId, action, section);
    });
    site.reload();
  }

  router.put('/content/:section', async (req, res) => {
    const module = await site.ssr();
    const section = String(req.params.section);
    if (!module.content.isSectionId(section)) return void res.status(404).json({ error: 'Unknown section.' });
    const parsed = contentSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid content.' });
    const errors = module.content.validateSection(section, parsed.data.doc);
    if (errors.length) return void res.status(422).json({ error: 'Please fix the following before saving:', errors });
    saveSection(section, parsed.data.doc, admin(res).id, 'Published content');
    res.json({ ok: true, updatedAt: now() });
  });

  router.delete('/content/:section', async (req, res) => {
    const module = await site.ssr();
    const section = String(req.params.section);
    if (!module.content.isSectionId(section)) return void res.status(404).json({ error: 'Unknown section.' });
    saveSection(section, null, admin(res).id, 'Reset content to default');
    res.json({ ok: true });
  });

  router.get('/content/:section/history', (req, res) => {
    res.json({
      items: (
        db
          .prepare('SELECT h.id, h.saved_at, h.doc IS NULL AS is_default, a.name AS saved_by FROM content_history h LEFT JOIN admins a ON a.id = h.saved_by WHERE h.section = ? ORDER BY h.id DESC')
          .all(String(req.params.section)) as Row[]
      ).map((row) => ({ ...row, is_default: Boolean(row.is_default) })),
    });
  });

  router.post('/content/:section/history/:id/restore', async (req, res) => {
    const module = await site.ssr();
    const section = String(req.params.section);
    const id = idParam(req);
    const row = id && (db.prepare('SELECT doc FROM content_history WHERE id = ? AND section = ?').get(id, section) as { doc: string | null } | undefined);
    if (!row) return void res.status(404).json({ error: 'That version no longer exists.' });
    const doc = row.doc === null ? null : JSON.parse(row.doc);
    if (doc !== null) {
      const errors = module.content.validateSection(section, doc);
      if (errors.length) return void res.status(422).json({ error: 'That version can no longer be used:', errors });
    }
    saveSection(section, doc, admin(res).id, 'Restored an earlier version');
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- media
  async function usage(key: string): Promise<string[]> {
    const module = await site.ssr();
    return module.content
      .listSections()
      .filter((section) => {
        const row = savedRow(section.id);
        const doc = row ? row.doc : JSON.stringify(module.content.describeSection(section.id, undefined).doc);
        return doc.includes(`"${key}"`);
      })
      .map((section) => section.title);
  }

  router.get('/media', async (_req, res) => {
    const module = await site.ssr();
    const uploaded = new Map((db.prepare('SELECT key, size, created_at FROM media').all() as Row[]).map((row) => [row.key, row]));
    const items = await Promise.all(
      module.content.listImages().map(async (image) => ({
        ...image,
        uploaded: uploaded.has(image.key),
        size: uploaded.get(image.key)?.size ?? null,
        createdAt: uploaded.get(image.key)?.created_at ?? null,
        usedIn: await usage(image.key),
      })),
    );
    res.json({ items });
  });

  router.post('/media', express.raw({ type: () => true, limit: '8mb' }), async (req, res, next) => {
    try {
      const body = req.body as Buffer;
      const info = Buffer.isBuffer(body) ? inspectImage(body) : null;
      if (!info) return void res.status(415).json({ error: 'Please upload a JPEG, PNG or WebP image.' });
      if (info.width < 16 || info.height < 16 || info.width > 12000 || info.height > 12000) return void res.status(422).json({ error: 'That image size is not supported.' });
      const key = `upload-${crypto.randomBytes(5).toString('hex')}`;
      const file = `${key}.${info.ext}`;
      await fs.mkdir(uploads, { recursive: true });
      await fs.writeFile(path.join(uploads, file), body);
      const alt = String(req.get('x-image-alt') ?? '').slice(0, 300);
      db.prepare('INSERT INTO media (key, file, mime, width, height, size, alt, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        key,
        file,
        info.mime,
        info.width,
        info.height,
        body.length,
        decodeURIComponent(alt),
        now(),
        admin(res).id,
      );
      site.reload();
      logActivity(db, admin(res).id, 'Uploaded image', key);
      res.status(201).json({ item: { key, src: `/uploads/${file}`, width: info.width, height: info.height, alt: decodeURIComponent(alt), altAr: '', uploaded: true, usedIn: [] } });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/media/:key', (req, res) => {
    const parsed = mediaPatchSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Invalid description.' });
    const result = db.prepare('UPDATE media SET alt = ?, alt_ar = ? WHERE key = ?').run(parsed.data.alt, parsed.data.altAr, String(req.params.key));
    if (!result.changes) return void res.status(404).json({ error: 'Only uploaded images can be edited.' });
    site.reload();
    res.json({ ok: true });
  });

  router.delete('/media/:key', async (req, res) => {
    const key = String(req.params.key);
    const row = db.prepare('SELECT file FROM media WHERE key = ?').get(key) as { file: string } | undefined;
    if (!row) return void res.status(404).json({ error: 'Only uploaded images can be deleted.' });
    const usedIn = await usage(key);
    if (usedIn.length) return void res.status(409).json({ error: `This image is used in: ${usedIn.join(', ')}. Replace it there first.` });
    db.prepare('DELETE FROM media WHERE key = ?').run(key);
    await fs.rm(path.join(uploads, path.basename(row.file)), { force: true });
    site.reload();
    logActivity(db, admin(res).id, 'Deleted image', key);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- account, integrations, activity, backup
  router.patch('/account', (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Please enter your name.' });
    db.prepare('UPDATE admins SET name = ? WHERE id = ?').run(parsed.data.name, admin(res).id);
    res.json({ admin: { ...admin(res), name: parsed.data.name } });
  });

  router.post('/account/password', async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: Object.values(fieldErrors(parsed.error)).flat()[0] ?? 'Please check the passwords.' });
    const row = db.prepare('SELECT password_hash FROM admins WHERE id = ?').get(admin(res).id) as { password_hash: string };
    if (!(await verifyPassword(parsed.data.current, row.password_hash))) return void res.status(400).json({ error: 'Your current password is not correct.' });
    await setPassword(db, admin(res).id, parsed.data.next);
    startSession(db, admin(res).id, req, res); // the old sessions were signed out
    logActivity(db, admin(res).id, 'Changed password');
    res.json({ ok: true });
  });

  router.post('/integrations/zoom/test', async (_req, res) => {
    if (!zoomConfigured()) return void res.status(400).json({ error: 'Zoom is not configured yet.' });
    try {
      await testZoom();
      res.json({ ok: true });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : 'Zoom did not respond.' });
    }
  });

  router.get('/activity', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    res.json({ items: db.prepare('SELECT x.id, x.at, x.action, x.target, x.detail, a.name AS admin FROM activity x LEFT JOIN admins a ON a.id = x.admin_id ORDER BY x.id DESC LIMIT ?').all(limit) });
  });

  router.get('/export', (_req, res) => {
    const dump = {
      exportedAt: now(),
      messages: (db.prepare('SELECT * FROM messages ORDER BY id').all() as Row[]).map(parseDetails),
      meetings: db.prepare('SELECT * FROM meetings ORDER BY id').all(),
      content: (db.prepare('SELECT section, doc, updated_at FROM content').all() as Row[]).map((row) => ({ ...row, doc: JSON.parse(String(row.doc)) })),
      settings: (db.prepare('SELECT key, value FROM settings').all() as Row[]).map((row) => ({ key: row.key, value: JSON.parse(String(row.value)) })),
      media: db.prepare('SELECT key, file, width, height, alt, alt_ar, created_at FROM media').all(),
    };
    logActivity(db, admin(res).id, 'Downloaded a backup');
    res.setHeader('Content-Disposition', `attachment; filename="xposure-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(dump);
  });

  router.use((_req, res) => void res.status(404).json({ error: 'Not found.' }));
  return router;
}

