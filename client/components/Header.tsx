import { useEffect, useState } from 'react';
import { site } from '../content/site';
import { useI18n } from '../i18n';
import { useScrollState } from '../motion';
import { ArrowUpRight, Close, Menu } from './icons';

export type Section = 'home' | 'about' | 'services' | 'work' | 'contact' | 'plan' | 'none';

/**
 * `switchPath` is this page in the other language (or that language's home page).
 * The header stays at the top while scrolling: it tucks away while the visitor reads
 * downwards and slides back as soon as they scroll up, so the CTA is always one move away.
 */
export function Header({ section, switchPath }: { section: Section; switchPath: string }) {
  // On the home page the header sits on top of the photo slider, in white.
  const overlay = section === 'home';
  const { t, href, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const other = locale === 'en' ? 'ar' : 'en';
  // Home: turn solid once the transparent header has scrolled away with the slider.
  const { scrolled, hidden } = useScrollState(overlay ? 140 : 24);
  const classes = [overlay && 'overlay', scrolled && 'is-scrolled', hidden && !open && 'is-hidden'].filter(Boolean).join(' ');

  const links: { path: string; label: string; section: Section }[] = [
    { path: '/about/', label: t.nav.agency, section: 'about' },
    { path: '/services/', label: t.nav.expertise, section: 'services' },
    { path: '/work/', label: t.nav.work, section: 'work' },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header id="top" className={classes || undefined}>
      <a className="wordmark" href={href('/')} aria-label={t.nav.home}>
        <img className="original-logo" src={site.logo.src} width={site.logo.width} height={site.logo.height} alt="Xposure" />
      </a>
      <nav id="site-nav" className={open ? 'open' : ''} aria-label={t.nav.label}>
        {links.map((link) => (
          <a key={link.path} href={href(link.path)} aria-current={section === link.section ? 'page' : undefined}>
            {link.label}
          </a>
        ))}
        <a className="mobile-contact" href={href('/contact/')} aria-current={section === 'contact' ? 'page' : undefined}>
          {t.nav.contact}
        </a>
      </nav>
      <a className="lang-switch" href={switchPath} lang={other} hrefLang={other} aria-label={t.switchLang.aria}>
        {t.switchLang.label}
      </a>
      <a className="nav-cta" href={href('/plan/')} aria-current={section === 'plan' ? 'page' : undefined}>
        <span>{t.nav.cta}</span> <ArrowUpRight size={17} />
      </a>
      <button
        type="button"
        className="menu-toggle"
        aria-label={open ? t.nav.close : t.nav.open}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        {open ? <Close /> : <Menu />}
      </button>
    </header>
  );
}
