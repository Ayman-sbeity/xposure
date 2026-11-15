// Analytics with consent. Google Tag Manager is loaded only when BOTH are true:
//   1. the build has a valid VITE_GTM_ID, and
//   2. the visitor has accepted analytics in the consent banner.
// Without an ID there is no banner, no cookie and no third-party request.
import { site } from './content/site';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type ContactMethod = 'form' | 'email_draft' | 'whatsapp' | 'phone' | 'email' | 'application';
export type Consent = 'granted' | 'denied';

const STORAGE_KEY = 'xposure-analytics-consent';
let gtmLoaded = false;

export function readConsent(): Consent | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null; // private mode or blocked storage: ask again next visit
  }
}

export function storeConsent(value: Consent): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

/** Injects GTM once. Call only after consent has been granted. */
export function loadGtm(): void {
  if (gtmLoaded || !site.gtmId || typeof window === 'undefined') return;
  gtmLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(site.gtmId)}`;
  document.head.appendChild(script);
}

/**
 * Conversion events. A no-op until GTM has been loaded with consent.
 * `brief_step` fires as a visitor moves through the /plan/ brief builder (step 2, 3, 4),
 * so the funnel and drop-off per step can be reported in GA4.
 * `chat_open` / `chat_question` come from the chat assistant. Only the detected `topic`
 * (e.g. "pricing") is sent, never the visitor's words, so you can see what people ask about.
 */
export function track(
  event: 'generate_lead' | 'contact_click' | 'file_download' | 'brief_step' | 'chat_open' | 'chat_question',
  params: { method?: ContactMethod; location?: string; service?: string; file?: string; step?: number; occasion?: string; topic?: string },
): void {
  if (typeof window === 'undefined' || !gtmLoaded || !Array.isArray(window.dataLayer)) return;
  window.dataLayer.push({ event, ...params });
}
