// Zoom integration (optional). With a Zoom "Server-to-Server OAuth" app's credentials in
// ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET, the admin panel creates the Zoom
// meeting and its link in one click (or automatically, if "auto-confirm" is on).
// Without them, the team pastes a meeting link by hand. Nothing else changes.
import { config } from './config.ts';

let cached: { token: string; expires: number } | null = null;

export const zoomConfigured = (): boolean => Boolean(config.zoom.accountId && config.zoom.clientId && config.zoom.clientSecret);

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const { accountId, clientId, clientSecret, oauthBase } = config.zoom;
  const response = await fetch(`${oauthBase}/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId ?? '')}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Zoom did not accept the credentials (HTTP ${response.status}). Check the ZOOM_* settings.`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export async function testZoom(): Promise<void> {
  cached = null;
  await accessToken();
}

export async function createZoomMeeting(input: { topic: string; startIso: string; durationMinutes: number; timezone: string; agenda: string }): Promise<{ id: string; joinUrl: string }> {
  const response = await fetch(`${config.zoom.apiBase}/users/${encodeURIComponent(config.zoom.userId)}/meetings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: input.topic.slice(0, 200),
      type: 2, // scheduled meeting
      start_time: input.startIso.replace(/\.\d{3}Z$/, 'Z'),
      duration: input.durationMinutes,
      timezone: input.timezone,
      agenda: input.agenda.slice(0, 2000),
      settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Zoom could not create the meeting (HTTP ${response.status}).`);
  const data = (await response.json()) as { id: number | string; join_url: string };
  return { id: String(data.id), joinUrl: data.join_url };
}

export async function deleteZoomMeeting(id: string): Promise<void> {
  const response = await fetch(`${config.zoom.apiBase}/meetings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Zoom could not cancel the meeting (HTTP ${response.status}).`);
}
