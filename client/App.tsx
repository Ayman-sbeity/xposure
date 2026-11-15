import { useEffect } from 'react';
import { ActionDock } from './components/ActionDock';
import { ChatWidget } from './components/ChatWidget';
import { ConsentBanner } from './components/ConsentBanner';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { I18nProvider, localeMeta, localizePath, splitLocale, stringsFor, type Locale } from './i18n';
import { useReveal } from './motion';
import { resolveRoute } from './routes';
import './style.css';
import './pages.css';
import './extras.css';
import './theme.css';
// Loaded last: the animation system, then the new marketing features.
import './motion.css';
import './features.css';

export default function App({ path }: { path: string }) {
  const route = resolveRoute(path);
  const locale = route.meta.locale;
  const other: Locale = locale === 'en' ? 'ar' : 'en';
  const switchPath = route.meta.alternates?.[other] ?? localizePath(other, '/');
  useReveal();

  // The phone action bar: not on the brief builder itself or the careers page (job seekers).
  // On a service page it opens the builder with that service already ticked.
  const englishPath = splitLocale(route.meta.path).path;
  const serviceSlug = /^\/services\/([^/]+)\/$/.exec(englishPath)?.[1];
  const showDock = route.section !== 'plan' && englishPath !== '/careers/';
  const planPath = serviceSlug ? `/plan/?service=${serviceSlug}` : '/plan/';

  // Prerendered pages already ship the right <title>, lang and dir; this keeps the dev server in sync.
  useEffect(() => {
    document.title = route.meta.title;
    document.documentElement.lang = localeMeta[locale].lang;
    document.documentElement.dir = localeMeta[locale].dir;
  }, [route.meta.title, locale]);

  return (
    <I18nProvider locale={locale}>
      <a className="skip" href="#main">
        {stringsFor(locale).skip}
      </a>
      <Header section={route.section} switchPath={switchPath} />
      <main id="main" tabIndex={-1}>
        {route.render()}
      </main>
      <Footer />
      <ChatWidget />
      {showDock && <ActionDock planPath={planPath} />}
      <ConsentBanner />
    </I18nProvider>
  );
}
