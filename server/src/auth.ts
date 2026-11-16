// Admin accounts and sign-in sessions.
//
// - Passwords are hashed with scrypt (memory-hard) and a random salt; never stored or logged.
// - A session is a random 256-bit token in an HttpOnly, SameSite=Strict cookie. Only its SHA-256
//   hash is stored, so a copy of the database cannot be used to sign in.
// - Changes from the admin panel must come from this site (Origin check) and carry a custom
//   header, which a form on another site cannot send (CSRF protection).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';
import { now, type Db } from './db.ts';

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_DAYS = 7;
export const MIN_PASSWORD = 10;
export const ADMIN_HEADER = 'x-xposure-admin';

export type Admin = { id: number; email: string; name: string };

export const cookieName = (): string => (config.cookieSecure ? '__Host-xp_admin' : 'xp_admin');

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(key, expected);
}

// A fixed hash to compare against when the email is unknown, so the response time does not
// reveal which emails have accounts.
let dummyHash: Promise<string> | undefined;
export const dummyPasswordHash = () => (dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex')));

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function cookie(value: string, maxAgeSeconds: number): string {
  return [`${cookieName()}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`, ...(config.cookieSecure ? ['Secure'] : [])].join('; ');
}

export async function createAdmin(db: Db, email: string, password: string, name: string): Promise<number> {
  if (password.length < MIN_PASSWORD) throw new Error(`The password must have at least ${MIN_PASSWORD} characters.`);
  const result = db
    .prepare('INSERT INTO admins (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(email.trim().toLowerCase(), name.trim() || email, await hashPassword(password), now());
  return Number(result.lastInsertRowid);
}

export async function setPassword(db: Db, adminId: number, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD) throw new Error(`The password must have at least ${MIN_PASSWORD} characters.`);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(await hashPassword(password), adminId);
  // Sign out everywhere else.
  db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(adminId);
}

export function startSession(db: Db, adminId: number, req: Request, res: Response): void {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO sessions (token_hash, admin_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)').run(
    sha256(token),
    adminId,
    now(),
    expires,
    req.ip ?? '',
    (req.get('user-agent') ?? '').slice(0, 200),
  );
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(now(), adminId);
  res.setHeader('Set-Cookie', cookie(token, SESSION_DAYS * 86400));
}

export function endSession(db: Db, req: Request, res: Response): void {
  const token = parseCookies(req.get('cookie'))[cookieName()];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', cookie('', 0));
}

export function currentAdmin(db: Db, req: Request): Admin | null {
  const token = parseCookies(req.get('cookie'))[cookieName()];
  if (!token || token.length > 100) return null;
  const row = db
    .prepare('SELECT a.id, a.email, a.name, s.expires_at FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?')
    .get(sha256(token)) as (Admin & { expires_at: string }) | undefined;
  if (!row || row.expires_at < now()) return null;
  return { id: row.id, email: row.email, name: row.name };
}

/** Every /api/admin route except sign-in. Puts the admin on res.locals.admin. */
export function requireAdmin(db: Db) {
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = currentAdmin(db, req);
    if (!admin) return void res.status(401).json({ error: 'Please sign in again.' });
    res.locals.admin = admin;
    next();
  };
}

/** Reject state-changing requests that do not come from this site's admin panel. */
export function sameOriginOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  let allowed = false;
  if (origin) {
    try {
      allowed = config.publicOrigin ? origin === config.publicOrigin : new URL(origin).host === req.get('host');
    } catch {
      allowed = false;
    }
  }
  if (!allowed || req.get(ADMIN_HEADER) !== '1') return void res.status(403).json({ error: 'This request was blocked for your security. Reload the page and try again.' });
  next();
}
