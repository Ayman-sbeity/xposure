import { useEffect, useState } from 'react';
import { loadGtm, readConsent, storeConsent } from '../analytics';
import { site } from '../content/site';
import { useI18n } from '../i18n';

const OPEN_EVENT = 'xposure:open-consent';

/** Lets the footer "Cookie settings" link reopen the banner so a choice can be changed. */
export function openConsentSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

/**
 * Analytics consent. Rendered only when a GTM ID is configured; analytics stay off
 * until the visitor accepts, and declining is as easy as accepting.
 */
export function ConsentBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!site.gtmId) return;
    const stored = readConsent();
    if (stored === 'granted') loadGtm();
    else if (stored === null) setVisible(true);
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!site.gtmId || !visible) return null;

  function choose(value: 'granted' | 'denied') {
    const previous = readConsent();
    storeConsent(value);
    setVisible(false);
    if (value === 'granted') loadGtm();
    // Withdrawing consent: reload so tags that were already running stop.
    else if (previous === 'granted') window.location.reload();
  }

  return (
    <section className="consent" role="region" aria-labelledby="consent-title">
      <div>
        <h2 id="consent-title">{t.consent.title}</h2>
        <p>
          {t.consent.text}{' '}
          <a href="/privacy/" hrefLang="en">
            {t.consent.more}
          </a>
        </p>
      </div>
      <div className="consent-actions">
        <button type="button" className="button consent-decline" onClick={() => choose('denied')}>
          {t.consent.decline}
        </button>
        <button type="button" className="button lime" onClick={() => choose('granted')}>
          {t.consent.accept}
        </button>
      </div>
    </section>
  );
}
