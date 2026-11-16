// Meeting availability. Times are planned in the business time zone (Asia/Beirut by default,
// including summer time) and stored in UTC.
import { getSetting, setSetting, type Db } from './db.ts';
import type { BookingSettings } from './schemas.ts';

export const DEFAULT_BOOKING: BookingSettings = {
  enabled: true,
  timezone: 'Asia/Beirut',
  durationMinutes: 30,
  bufferMinutes: 15,
  minNoticeHours: 24,
  windowDays: 21,
  weekly: {
    mon: [['10:00', '17:00']],
    tue: [['10:00', '17:00']],
    wed: [['10:00', '17:00']],
    thu: [['10:00', '17:00']],
    fri: [['10:00', '17:00']],
    sat: [],
    sun: [],
  },
  blockedDates: [],
  autoConfirm: false,
};

export function bookingSettings(db: Db): BookingSettings {
  return { ...DEFAULT_BOOKING, ...(getSetting<BookingSettings>(db, 'booking') ?? {}) };
}
export function saveBookingSettings(db: Db, settings: BookingSettings): void {
  setSetting(db, 'booking', settings);
}

// ---------------------------------------------------------------------------
// Time-zone arithmetic with the built-in Intl API (no date library needed)
// ---------------------------------------------------------------------------
const formatters = new Map<string, Intl.DateTimeFormat>();
function parts(utcMs: number, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(timeZone, format);
  }
  const out: Record<string, number> = {};
  for (const part of format.formatToParts(new Date(utcMs))) if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Minutes the zone is ahead of UTC at that instant (e.g. 180 for Beirut in summer). */
export function zoneOffset(utcMs: number, timeZone: string): number {
  const p = parts(utcMs, timeZone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000) / 60000;
}

/** "2027-03-15" + "10:30" in Beirut -> UTC milliseconds. */
export function zonedToUtc(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  const first = wall - zoneOffset(wall, timeZone) * 60000;
  const second = wall - zoneOffset(first, timeZone) * 60000;
  return second;
}

/** The calendar date in the zone, as YYYY-MM-DD. */
export function zonedDate(utcMs: number, timeZone: string): string {
  const p = parts(utcMs, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10);
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const fromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export type SlotDay = { date: string; slots: string[] };

/** Free start times (UTC ISO strings) grouped by local date. */
export function availableSlots(db: Db, settings: BookingSettings, nowMs = Date.now()): SlotDay[] {
  if (!settings.enabled) return [];
  const duration = settings.durationMinutes * 60000;
  const buffer = settings.bufferMinutes * 60000;
  const earliest = nowMs + settings.minNoticeHours * 3600000;
  const busy = (
    db.prepare("SELECT start_at, end_at FROM meetings WHERE status IN ('pending', 'confirmed') AND end_at > ?").all(new Date(nowMs).toISOString()) as {
      start_at: string;
      end_at: string;
    }[]
  ).map((m) => [Date.parse(m.start_at) - buffer, Date.parse(m.end_at) + buffer] as const);
  const blocked = new Set(settings.blockedDates);
  const today = zonedDate(nowMs, settings.timezone);
  const days: SlotDay[] = [];

  for (let i = 0; i < settings.windowDays; i++) {
    const date = addDays(today, i);
    if (blocked.has(date)) continue;
    const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const slots: string[] = [];
    for (const [from, to] of settings.weekly[weekday]) {
      for (let minute = toMinutes(from); minute + settings.durationMinutes <= toMinutes(to); minute += settings.durationMinutes) {
        const start = zonedToUtc(date, fromMinutes(minute), settings.timezone);
        const end = start + duration;
        if (start < earliest) continue;
        if (busy.some(([busyFrom, busyTo]) => start < busyTo && end > busyFrom)) continue;
        slots.push(new Date(start).toISOString());
      }
    }
    if (slots.length) days.push({ date, slots });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Calendar file (.ics) for a meeting
// ---------------------------------------------------------------------------
const icsDate = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Lines longer than 75 bytes are folded, as the iCalendar format requires. */
function fold(line: string): string {
  const out: string[] = [];
  let current = '';
  for (const char of line) {
    if (Buffer.byteLength(current + char) > 74) {
      out.push(current);
      current = ` ${char}`;
    } else current += char;
  }
  out.push(current);
  return out.join('\r\n');
}

export function meetingIcs(meeting: { id: number; start_at: string; end_at: string; join_url: string; name: string; topic: string; message: string }, organizer: { name: string; email: string; url: string }): string {
  const description = [`Video meeting with ${organizer.name}.`, meeting.join_url ? `Join: ${meeting.join_url}` : 'The meeting link will follow.', meeting.message].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${organizer.name}//Meetings//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:meeting-${meeting.id}@${new URL(organizer.url).host}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(meeting.start_at)}`,
    `DTEND:${icsDate(meeting.end_at)}`,
    `SUMMARY:${icsText(`${organizer.name} — meeting with ${meeting.name}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    ...(meeting.join_url ? [`LOCATION:${icsText(meeting.join_url)}`, `URL:${meeting.join_url}`] : []),
    `ORGANIZER;CN=${icsText(organizer.name)}:mailto:${organizer.email}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
