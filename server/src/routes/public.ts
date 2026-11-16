// API used by the public website: enquiries, event briefs, job applications and meeting booking.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { availableSlots, bookingSettings } from '../booking.ts';
import { now, transaction, type Db } from '../db.ts';
import { fieldErrors, meetingSchema, messageSchema, type MessageInput } from '../schemas.ts';
import type { SiteHandle } from '../site.ts';
import { createZoomMeeting, zoomConfigured } from '../zoom.ts';

const limit = (windowMinutes: number, max: number, error: string) =>
  rateLimit({ windowMs: windowMinutes * 60_000, limit: max, standardHeaders: 'draft-7', legacyHeaders: false, message: { error } });

/** One subject line and a set of details per kind of message, for the inbox. */
function summarize(input: MessageInput) {
  switch (input.type) {
    case 'enquiry':
      return { subject: `Enquiry — ${input.service}`, service: input.service, body: input.message, details: { date: input.date } };
    case 'brief':
      return {
        subject: `Event brief — ${input.occasion}`,
        service: input.services.join(', '),
        body: input.notes,
        details: { occasion: input.occasion, services: input.services, date: input.date, location: input.location, guests: input.guests, duration: input.duration },
      };
    case 'application':
      return { subject: `Job application — ${input.role}`, service: input.role, body: input.experience, details: { role: input.role, city: input.city, languages: input.languages } };
  }
}

export function publicRoutes(db: Db, site: SiteHandle): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  router.post('/messages', limit(10, 8, 'Too many messages from your connection. Please try again later, or contact us on WhatsApp.'), (req, res) => {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: 'Please check the highlighted details.', fields: fieldErrors(parsed.error) });
    const input = parsed.data;
    // Bots fill in the hidden field: answer as if it worked, store nothing.
    if (input.website) return void res.status(201).json({ id: 0 });
    const { subject, service, body, details } = summarize(input);
    const stamp = now();
    const result = db
      .prepare(
        `INSERT INTO messages (type, name, email, phone, company, service, subject, body, details, channel, locale, page, campaign, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(input.type, input.name, input.email, input.phone, input.company, service, subject, body, JSON.stringify(details), input.channel, input.locale, input.page, input.campaign, stamp, stamp);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  router.get('/meetings/slots', (_req, res) => {
    const settings = bookingSettings(db);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ enabled: settings.enabled, timezone: settings.timezone, durationMinutes: settings.durationMinutes, days: availableSlots(db, settings) });
  });

  router.post('/meetings', limit(30, 5, 'Too many booking attempts. Please try again later, or contact us on WhatsApp.'), async (req, res, next) => {
    try {
      const parsed = meetingSchema.safeParse(req.body);
      if (!parsed.success) return void res.status(400).json({ error: 'Please check the highlighted details.', fields: fieldErrors(parsed.error) });
      const input = parsed.data;
      const settings = bookingSettings(db);
      if (input.website) return void res.status(201).json({ id: 0, status: 'pending', start: input.start });
      if (!settings.enabled) return void res.status(409).json({ error: 'Online booking is paused. Please contact us on WhatsApp.' });

      const start = new Date(input.start).toISOString();
      const end = new Date(Date.parse(start) + settings.durationMinutes * 60_000).toISOString();
      // Check and book in one step so two visitors can never take the same time.
      const id = transaction(db, () => {
        const free = availableSlots(db, settings).some((day) => day.slots.includes(start));
        if (!free) return null;
        const stamp = now();
        const result = db
          .prepare(
            `INSERT INTO meetings (start_at, end_at, name, email, phone, company, topic, message, locale, campaign, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(start, end, input.name, input.email, input.phone, input.company, input.topic, input.message, input.locale, input.campaign, stamp, stamp);
        return Number(result.lastInsertRowid);
      });
      if (id === null) return void res.status(409).json({ error: 'That time has just been taken. Please choose another time.' });

      let status = 'pending';
      let joinUrl = '';
      if (settings.autoConfirm && zoomConfigured()) {
        try {
          const business = (await site.ssr()).business();
          const zoom = await createZoomMeeting({ topic: `${business.name} — ${input.name}`, startIso: start, durationMinutes: settings.durationMinutes, timezone: settings.timezone, agenda: input.message });
          db.prepare("UPDATE meetings SET status = 'confirmed', join_url = ?, zoom_meeting_id = ?, updated_at = ? WHERE id = ?").run(zoom.joinUrl, zoom.id, now(), id);
          status = 'confirmed';
          joinUrl = zoom.joinUrl;
        } catch (error) {
          // The request is still saved; the team confirms it by hand.
          console.error('Zoom auto-confirm failed:', error instanceof Error ? error.message : error);
        }
      }
      res.status(201).json({ id, status, start, end, joinUrl, timezone: settings.timezone });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
