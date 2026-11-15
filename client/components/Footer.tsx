import { track } from '../analytics';
import { getServices } from '../content/services';
import { site, whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { openConsentSettings } from './ConsentBanner';
import { Instagram, Linkedin, Mail } from './icons';
import { staggerIndex } from './Sections';

export function Footer() {
  const { t, href, locale } = useI18n();
  return (
    <footer>
      <div className="footer-top">
        <a href={href('/')} className="wordmark" aria-label={t.nav.home} dir="ltr">
          <span className="brand-x">X</span>POSURE<span className="brand-dot">®</span>
        </a>
        <span>{t.footer.tagline}</span>
        <div className="socials">
          <a href={site.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label={t.footer.instagram}>
            <Instagram size={19} />
          </a>
          <a href={site.socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label={t.footer.linkedin}>
            <Linkedin size={19} />
          </a>
          <a href={`mailto:${site.email}`} aria-label={t.footer.email}>
            <Mail size={20} />
          </a>
        </div>
      </div>
      <div className="footer-links stagger">
        <nav aria-labelledby="footer-services" style={staggerIndex(0)}>
          <h2 id="footer-services" className="footer-heading">{t.footer.services}</h2>
          <ul>
            {getServices(locale).map((service) => (
              <li key={service.slug}>
                <a href={href(`/services/${service.slug}/`)}>{service.name}</a>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-agency" style={staggerIndex(1)}>
          <h2 id="footer-agency" className="footer-heading">{t.footer.agency}</h2>
          <ul>
            <li><a href={href('/plan/')}>{t.crumbs.plan}</a></li>
            <li><a href={href('/about/')}>{t.footer.about}</a></li>
            <li><a href={href('/work/')}>{t.footer.work}</a></li>
            <li><a href={href('/careers/')}>{t.footer.careers}</a></li>
            <li><a href="/guides/" hrefLang="en">{t.footer.guides}</a></li>
            <li><a href={href('/contact/')}>{t.footer.contact}</a></li>
          </ul>
        </nav>
        <div style={staggerIndex(2)}>
          <h2 className="footer-heading">{t.footer.getInTouch}</h2>
          <ul>
            <li>
              <a href={`mailto:${site.email}`} onClick={() => track('contact_click', { method: 'email', location: 'footer' })}>
                {site.email}
              </a>
            </li>
            <li>
              <a href={`tel:${site.phone}`} dir="ltr" onClick={() => track('contact_click', { method: 'phone', location: 'footer' })}>
                {site.phoneDisplay}
              </a>
            </li>
            <li>
              <a
                href={whatsappLink(t.common.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('contact_click', { method: 'whatsapp', location: 'footer' })}
              >
                WhatsApp
              </a>
            </li>
            <li>{site.streetAddress ? `${site.streetAddress}, ` : ''}{t.common.location}</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> {t.footer.rights}
        </span>
        <span className="footer-legal">
          <a href="/privacy/" hrefLang="en">{t.footer.privacy}</a>
          {site.gtmId && (
            <button type="button" className="link-button" onClick={openConsentSettings}>
              {t.footer.cookies}
            </button>
          )}
        </span>
        <a href="#top">{t.footer.top}</a>
      </div>
    </footer>
  );
}
