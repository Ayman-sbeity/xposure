// The admin panel's connection to /api/admin, plus the shapes of the data it receives.

export class ApiError extends Error {
  status: number;
  errors: string[];
  constructor(message: string, status: number, errors: string[] = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

let onSignedOut: (() => void) | null = null;
/** Called when the session has expired, so the app can show the sign-in screen. */
export const whenSignedOut = (fn: () => void) => (onSignedOut = fn);

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; file?: Blob; headers?: Record<string, string> };

export async function api<T>(path: string, { method = 'GET', body, file, headers = {} }: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        // Required by the server for every change (protects against cross-site requests).
        'X-Xposure-Admin': '1',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(file ? { 'Content-Type': file.type || 'application/octet-stream' } : {}),
        ...headers,
      },
      body: file ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const data = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
  if (response.status === 401 && path !== '/login') onSignedOut?.();
  if (!response.ok) throw new ApiError(data?.error ?? 'Something went wrong.', response.status, data?.errors ?? []);
  return data as T;
}

// ------------------------------------------------------------------ types
export type Admin = { id: number; email: string; name: string };
export type Me = { admin: Admin; zoom: boolean; timezone: string };

export type MessageType = 'enquiry' | 'brief' | 'application';
export type MessageStatus = 'new' | 'read' | 'replied' | 'archived' | 'spam';
export type MessageSummary = {
  id: number;
  type: MessageType;
  status: MessageStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  preview: string;
  channel: string;
  campaign: string;
  created_at: string;
};
export type Message = MessageSummary & { body: string; service: string; details: Record<string, string | string[]>; locale: 'en' | 'ar'; page: string; note: string; updated_at: string };
export type MessageList = { items: MessageSummary[]; total: number; counts: Record<string, number> };

export type MeetingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type Meeting = {
  id: number;
  status: MeetingStatus;
  start_at: string;
  end_at: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  topic: string;
  message: string;
  locale: 'en' | 'ar';
  campaign: string;
  join_url: string;
  zoom_meeting_id: string;
  note: string;
  created_at: string;
};
export type MeetingList = { items: Meeting[]; counts: { pending: number; upcoming: number }; timezone: string; durationMinutes: number; zoom: boolean };

export type Stats = {
  timezone: string;
  newMessages: number;
  pendingMeetings: number;
  upcomingMeetings: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  daily: { date: string; enquiry: number; brief: number; application: number; meeting: number }[];
  sources: { label: string; value: number }[];
  services: { label: string; value: number }[];
  nextMeetings: Pick<Meeting, 'id' | 'status' | 'start_at' | 'end_at' | 'name' | 'company' | 'topic'>[];
  recentMessages: Pick<MessageSummary, 'id' | 'type' | 'status' | 'name' | 'subject' | 'created_at'>[];
};

export type BookingSettings = {
  enabled: boolean;
  timezone: string;
  durationMinutes: 15 | 20 | 30 | 45 | 60;
  bufferMinutes: number;
  minNoticeHours: number;
  windowDays: number;
  weekly: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>;
  blockedDates: string[];
  autoConfirm: boolean;
};
export type BookingResponse = { settings: BookingSettings; zoom: boolean; preview: { date: string; slots: string[] }[] };

export type SectionSummary = { id: string; title: string; description: string; viewPath: string; customized: boolean; updatedAt: string | null; updatedBy: string | null };
export type FieldHint = { kind?: string; label?: string; help?: string; options?: { value: string; label: string }[] };
export type SectionDetail = {
  id: string;
  title: string;
  description: string;
  viewPath: string;
  doc: unknown;
  defaults: unknown;
  hints: Record<string, FieldHint>;
  templates: Record<string, unknown>;
  customized: boolean;
};
export type HistoryItem = { id: number; saved_at: string; is_default: boolean; saved_by: string | null };

export type MediaItem = { key: string; src: string; width: number; height: number; alt: string; altAr: string; uploaded: boolean; size: number | null; createdAt: string | null; usedIn: string[] };
export type ActivityItem = { id: number; at: string; action: string; target: string; detail: string; admin: string | null };
