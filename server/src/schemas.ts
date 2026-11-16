// Every request body is checked here before it is used. Unknown fields are rejected,
// text is trimmed and length-limited.
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().default('');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = text(254).regex(EMAIL, 'Please enter a valid email address.');
const optionalEmail = text(254)
  .refine((value) => value === '' || EMAIL.test(value), 'Please enter a valid email address.')
  .optional()
  .default('');
const phone = text(30).regex(/^[+\d\s()-]*$/, 'Use digits, spaces, +, - and brackets only.').optional().default('');
const date = text(10).regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a date such as 2027-03-15.').optional().default('');

const common = {
  name: text(100).min(2, 'Please enter your name.'),
  company: optional(150),
  channel: z.enum(['form', 'whatsapp', 'email']).default('form'),
  locale: z.enum(['en', 'ar']).default('en'),
  page: optional(200),
  campaign: optional(200),
  /** Honeypot: people never see this field; bots fill it in. */
  website: z.string().max(500).optional(),
};

export const messageSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ type: z.literal('enquiry'), ...common, email, phone, service: text(120), date, message: text(4000).min(10, 'Please tell us a little more.') }),
    z.strictObject({
      type: z.literal('brief'),
      ...common,
      email: optionalEmail,
      phone,
      occasion: text(80),
      services: z.array(text(120)).max(12),
      date,
      location: optional(120),
      guests: optional(40),
      duration: optional(40),
      notes: optional(4000),
    }),
    z.strictObject({
      type: z.literal('application'),
      ...common,
      email,
      phone: text(30).min(6, 'Please enter your phone number.').regex(/^[+\d\s()-]*$/),
      role: text(80),
      city: optional(100),
      languages: optional(150),
      experience: optional(2000),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.type === 'brief' && value.channel === 'form' && !value.email && !value.phone) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Add an email or phone number so the team can reply.' });
    }
  });
export type MessageInput = z.infer<typeof messageSchema>;

export const MEETING_TOPICS = ['questions', 'event', 'proposal', 'other'] as const;

export const meetingSchema = z.strictObject({
  start: z.iso.datetime(),
  name: common.name,
  email,
  phone,
  company: common.company,
  topic: z.enum(MEETING_TOPICS).default('questions'),
  message: optional(2000),
  locale: common.locale,
  campaign: common.campaign,
  website: common.website,
});

export const loginSchema = z.strictObject({ email: text(254), password: z.string().max(200) });

export const MESSAGE_STATUSES = ['new', 'read', 'replied', 'archived', 'spam'] as const;
export const messagePatchSchema = z.strictObject({ status: z.enum(MESSAGE_STATUSES).optional(), note: text(4000).optional() });

export const MEETING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const;
export const meetingPatchSchema = z.strictObject({
  status: z.enum(MEETING_STATUSES).optional(),
  joinUrl: text(500)
    .refine((value) => value === '' || /^https:\/\/\S+$/.test(value), 'The meeting link must start with https://')
    .optional(),
  note: text(4000).optional(),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour times such as 09:30.');
const range = z.tuple([time, time]).refine(([from, to]) => from < to, 'Each time range must end after it starts.');
const day = z.array(range).max(4);
const validTimeZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

export const bookingSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  timezone: z.string().refine(validTimeZone, 'Unknown time zone.'),
  durationMinutes: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]),
  bufferMinutes: z.number().int().min(0).max(120),
  minNoticeHours: z.number().int().min(0).max(336),
  windowDays: z.number().int().min(1).max(90),
  weekly: z.strictObject({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }),
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(366),
  autoConfirm: z.boolean(),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const passwordSchema = z.strictObject({ current: z.string().max(200), next: z.string().min(10, 'Use at least 10 characters.').max(200) });
export const accountSchema = z.strictObject({ name: text(100).min(2) });
export const mediaPatchSchema = z.strictObject({ alt: text(300), altAr: text(300) });
export const contentSchema = z.strictObject({ doc: z.unknown() });

/** Field-by-field messages for the forms. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
