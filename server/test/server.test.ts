// Server tests. Run after a build (they use the production bundle): npm run build && npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.ts';
import { createAdmin } from '../src/auth.ts';
import { availableSlots, DEFAULT_BOOKING, meetingIcs, zonedDate, zonedToUtc } from '../src/booking.ts';
import { openDatabase, type Db } from '../src/db.ts';
import { inspectImage, toCsv } from '../src/files.ts';

describe('time zones (Asia/Beirut)', () => {
  test('winter time is UTC+2', () => {
    assert.equal(new Date(zonedToUtc('2027-01-15', '10:00', 'Asia/Beirut')).toISOString(), '2027-01-15T08:00:00.000Z');
  });
  test('summer time is UTC+3', () => {
    assert.equal(new Date(zonedToUtc('2027-07-15', '10:00', 'Asia/Beirut')).toISOString(), '2027-07-15T07:00:00.000Z');
  });
  test('local calendar date', () => {
    assert.equal(zonedDate(Date.parse('2027-01-15T23:30:00Z'), 'Asia/Beirut'), '2027-01-16');
  });
});

describe('meeting availability', () => {
  const db = openDatabase(':memory:');
  const monday10 = zonedToUtc('2027-03-01', '10:00', 'Asia/Beirut'); // a Monday
  const settings = { ...DEFAULT_BOOKING, minNoticeHours: 0, windowDays: 7 };

  test('slots follow the weekly hours and length', () => {
    const days = availableSlots(db, settings, monday10 - 3600_000);
    assert.equal(days[0].date, '2027-03-01');
    assert.equal(days[0].slots.length, 14); // 10:00–17:00 in 30-minute steps
    assert.ok(!days.some((d) => ['2027-03-06', '2027-03-07'].includes(d.date)), 'weekend closed');
  });
  test('minimum notice hides times that are too soon', () => {
    const days = availableSlots(db, { ...settings, minNoticeHours: 24 }, monday10);
    assert.notEqual(days[0].date, '2027-03-01');
  });
  test('blocked dates are skipped', () => {
    const days = availableSlots(db, { ...settings, blockedDates: ['2027-03-01'] }, monday10 - 3600_000);
    assert.notEqual(days[0].date, '2027-03-01');
  });
  test('a booking removes its slot and the buffer around it', () => {
    const start = new Date(zonedToUtc('2027-03-01', '12:00', 'Asia/Beirut')).toISOString();
    const end = new Date(Date.parse(start) + 30 * 60_000).toISOString();
    db.prepare("INSERT INTO meetings (start_at, end_at, name, email, created_at, updated_at) VALUES (?, ?, 'A', 'a@b.co', ?, ?)").run(start, end, start, start);
    const slots = availableSlots(db, settings, monday10 - 3600_000)[0].slots;
    const at = (time: string) => new Date(zonedToUtc('2027-03-01', time, 'Asia/Beirut')).toISOString();
    for (const taken of ['11:30', '12:00', '12:30']) assert.ok(!slots.includes(at(taken)), `${taken} should be blocked`);
    assert.ok(slots.includes(at('11:00')) && slots.includes(at('13:00')));
  });
});

describe('files', () => {
  test('calendar file is valid and folded', () => {
    const ics = meetingIcs(
      { id: 7, start_at: '2027-03-01T08:00:00.000Z', end_at: '2027-03-01T08:30:00.000Z', join_url: 'https://zoom.us/j/1', name: 'Rania', topic: 'event', message: 'x'.repeat(200) },
      { name: 'Xposure', email: 'info@xposurelb.com', url: 'https://xposurelb.com' },
    );
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /DTSTART:20270301T080000Z/);
    assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  });
  test('images are recognised by their bytes, with their size', () => {
    const png = Buffer.alloc(40);
    png.writeUInt32BE(0x89504e47, 0);
    png.writeUInt32BE(0x0d0a1a0a, 4);
    png.write('IHDR', 12, 'ascii');
    png.writeUInt32BE(1600, 16);
    png.writeUInt32BE(900, 20);
    assert.deepEqual(inspectImage(png), { mime: 'image/png', ext: 'png', width: 1600, height: 900 });
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    assert.equal(inspectImage(svg), null);
  });
  test('CSV cannot inject spreadsheet formulas', () => {
    const csv = toCsv([{ a: '=HYPERLINK("http://evil")', b: 'Hello, "world"' }], [['a', 'A'], ['b', 'B']]);
    assert.ok(csv.startsWith('﻿'));
    assert.match(csv, /'=HYPERLINK/);
    assert.match(csv, /"Hello, ""world"""/);
  });
});

describe('API', () => {
  let db: Db;
  let server: http.Server;
  let base = '';
  let dir = '';
  let cookie = '';
  const admin = (extra: Record<string, string> = {}) => ({ Origin: base, 'X-Xposure-Admin': '1', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra });
  const post = (url: string, body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
    fetch(base + url, { method: 'POST', headers, body: JSON.stringify(body) });

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xposure-test-'));
    db = openDatabase(path.join(dir, 'test.db'));
    await createAdmin(db, 'owner@example.com', 'correct-horse-battery', 'Owner');
    server = http.createServer();
    const { app } = await createApp({ db, production: true, dataDir: dir, httpServer: server });
    server.on('request', app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  after(() => {
    server.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a valid enquiry is saved', async () => {
    const res = await post('/api/messages', { type: 'enquiry', name: 'Rania', email: 'rania@example.com', service: 'Event coordination', message: 'We need hostesses for a launch.', locale: 'en' });
    assert.equal(res.status, 201);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n, 1);
  });
  test('invalid input and unknown fields are rejected', async () => {
    const res = await post('/api/messages', { type: 'enquiry', name: 'R', email: 'nope', service: 'x', message: 'short', admin: true });
    assert.equal(res.status, 400);
  });
  test('the bot trap answers success but stores nothing', async () => {
    const before = (db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n;
    const res = await post('/api/messages', { type: 'enquiry', name: 'Bot', email: 'bot@example.com', service: 'x', message: 'Buy cheap things now!!', website: 'http://spam' });
    assert.equal(res.status, 201);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n, before);
  });
  test('a meeting time can only be booked once', async () => {
    const slots = (await (await fetch(`${base}/api/meetings/slots`)).json()) as { days: { slots: string[] }[] };
    const start = slots.days[0].slots[0];
    const first = await post('/api/meetings', { start, name: 'Karim', email: 'karim@example.com', locale: 'en' });
    assert.equal(first.status, 201);
    const second = await post('/api/meetings', { start, name: 'Other', email: 'other@example.com', locale: 'en' });
    assert.equal(second.status, 409);
  });
  test('admin API needs a session', async () => {
    assert.equal((await fetch(`${base}/api/admin/stats`)).status, 401);
  });
  test('sign-in is refused without the admin panel header (CSRF protection)', async () => {
    const res = await post('/api/admin/login', { email: 'owner@example.com', password: 'correct-horse-battery' }, { 'Content-Type': 'application/json', Origin: 'https://evil.example' });
    assert.equal(res.status, 403);
  });
  test('wrong password is refused, right password signs in', async () => {
    assert.equal((await post('/api/admin/login', { email: 'owner@example.com', password: 'wrong-password' }, admin())).status, 401);
    const res = await post('/api/admin/login', { email: 'owner@example.com', password: 'correct-horse-battery' }, admin());
    assert.equal(res.status, 200);
    const set = res.headers.get('set-cookie') ?? '';
    assert.match(set, /HttpOnly/);
    assert.match(set, /SameSite=Strict/);
    cookie = set.split(';')[0];
    assert.equal((await fetch(`${base}/api/admin/stats`, { headers: admin() })).status, 200);
  });
  test('content edits are validated, published and can be reset', async () => {
    const section = (await (await fetch(`${base}/api/admin/content/home`, { headers: admin() })).json()) as { doc: { slides: { caption: { en: string }; link: string }[] } };
    const doc = structuredClone(section.doc);
    doc.slides[0].link = 'javascript:alert(1)';
    assert.equal((await fetch(`${base}/api/admin/content/home`, { method: 'PUT', headers: admin(), body: JSON.stringify({ doc }) })).status, 422);
    doc.slides[0].link = '/plan/';
    doc.slides[0].caption.en = 'Tested caption';
    assert.equal((await fetch(`${base}/api/admin/content/home`, { method: 'PUT', headers: admin(), body: JSON.stringify({ doc }) })).status, 200);
    assert.match(await (await fetch(`${base}/`)).text(), /Tested caption/);
    assert.equal((await fetch(`${base}/api/admin/content/home`, { method: 'DELETE', headers: admin() })).status, 200);
    assert.doesNotMatch(await (await fetch(`${base}/`)).text(), /Tested caption/);
  });
  test('security headers are set on pages', async () => {
    const res = await fetch(`${base}/`);
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await fetch(`${base}/about`, { redirect: 'manual' })).status, 301);
    assert.equal((await fetch(`${base}/no-such-page/`)).status, 404);
  });
  test('sign out ends the session', async () => {
    await post('/api/admin/logout', {}, admin());
    assert.equal((await fetch(`${base}/api/admin/stats`, { headers: admin() })).status, 401);
  });
});
