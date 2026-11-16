// Small client for the website's own API (only used when runtime.api is true).

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; fields?: Record<string, string[]> };

/** POST JSON and never throw: network problems come back as { ok: false }. */
export async function postJson<T>(path: string, body: unknown, { keepalive = false } = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
      // keepalive lets a request finish even if the page then navigates (e.g. to WhatsApp).
      keepalive,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, data: data as T };
    return { ok: false, status: response.status, error: data.error ?? 'Request failed', fields: data.fields };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    return response.ok ? { ok: true, data: data as T } : { ok: false, status: response.status, error: data.error ?? 'Request failed' };
  } catch {
    return { ok: false, status: 0, error: 'Network error' };
  }
}
