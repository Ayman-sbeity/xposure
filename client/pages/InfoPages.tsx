import { ContactSection } from '../components/ContactSection';
import { ArrowUpRight } from '../components/icons';
import { PageHero } from '../components/PageHero';
import { CtaBand, FaqSection, Lines, ProcessSection, SectionLabel, TrustSection } from '../components/Sections';
import { getServices } from '../content/services';
import { site } from '../content/site';
import { useI18n } from '../i18n';
import { AboutBottom } from './HomePage';

// Mission copy adapted from https://xposurelb.com/index.php/xposure-hostess-company-in-lebanon/
export function AboutPage() {
  const { t, href, locale } = useI18n();
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.about, path: '/about/' }]}
        eyebrow={t.aboutPage.eyebrow}
        title={t.aboutPage.title}
        accent={t.aboutPage.accent}
        lede={t.aboutPage.lede}
        image="team"
      >
        <a className="button dark" href={href('/contact/')}>
          {t.aboutPage.cta} <ArrowUpRight size={20} />
        </a>
      </PageHero>

      <section className="about section" aria-labelledby="about-title">
        <SectionLabel index={t.about.labelPlain}>{t.about.right}</SectionLabel>
        <div className="about-grid">
          <div className="reveal">
            <h2 id="about-title">
              <Lines lines={t.about.lines} accent={t.about.accent} />
            </h2>
          </div>
          <div className="about-copy reveal">
            <p className="large">{t.aboutPage.large}</p>
            {t.aboutPage.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        <AboutBottom photo="hostesses" />
      </section>

      <section className="section other-services" aria-labelledby="what-title">
        <h2 id="what-title" className="small-heading">
          {t.aboutPage.whatWeDo}
        </h2>
        <ul>
          {getServices(locale).map((s) => (
            <li key={s.slug}>
              <a href={href(`/services/${s.slug}/`)}>
                {s.name} <ArrowUpRight size={20} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <TrustSection />
      <ProcessSection />

      <section className="section join-band" aria-labelledby="join-title">
        <h2 id="join-title">{t.aboutPage.joinTitle}</h2>
        <a className="text-link" href={href('/careers/')}>
          {t.aboutPage.joinLink} <ArrowUpRight size={18} />
        </a>
      </section>

      <CtaBand title={t.aboutPage.ctaTitle} accent={t.aboutPage.ctaAccent} text={t.aboutPage.ctaText} />
    </>
  );
}

export function ContactPage() {
  return (
    <>
      <ContactSection headingLevel={1} />
      <FaqSection />
    </>
  );
}

export function NotFoundPage() {
  const { t, href } = useI18n();
  return (
    <section className="page-hero not-found">
      <div className="page-hero-copy">
        <span className="eyebrow">{t.notFound.eyebrow}</span>
        <h1>
          {t.notFound.title} <span className="serif">{t.notFound.accent}</span>
        </h1>
        <p className="page-lede">{t.notFound.lede}</p>
        <ul className="tag-list">
          <li><a href={href('/')}>{t.crumbs.home}</a></li>
          <li><a href={href('/services/')}>{t.crumbs.services}</a></li>
          <li><a href={href('/work/')}>{t.crumbs.work}</a></li>
          <li><a href={href('/contact/')}>{t.crumbs.contact}</a></li>
        </ul>
      </div>
    </section>
  );
}

/**
 * Privacy notice (English). It describes only what this website actually does.
 * Have it reviewed by the owner / legal adviser before launch, and update it when the
 * enquiry API, a retention period or any new tool is introduced.
 */
export function PrivacyPage() {
  return (
    <>
      <PageHero
        trail={[{ name: 'Privacy', path: '/privacy/' }]}
        eyebrow="PRIVACY"
        title="Privacy"
        accent="notice."
        lede="This notice explains what information the Xposure website handles, why, and the choices you have."
      />
      <section className="section legal">
        <div className="prose">
          <h2>Who we are</h2>
          <p>
            This website is operated by Xposure, a hostess and promoter agency based in {site.locality}, {site.countryName}. For any privacy
            question or request, email <a href={`mailto:${site.email}`}>{site.email}</a>.
          </p>

          <h2>Information you send us</h2>
          <p>
            When you use the enquiry form we ask for your name, email address, the service you are interested in and a description of your
            event. Company, phone number and event date are optional. The application form on the careers page asks for your name, contact
            details, city, languages, the role you are interested in and your experience and availability.
          </p>
          <p>
            This website has no server of its own. The forms prepare a message in your own email app or in WhatsApp. Nothing is sent until
            you press send there, and this website does not store what you type.
          </p>
          <p>
            If you contact us by email, phone or WhatsApp, we receive the details you choose to share through those services, which have
            their own privacy terms.
          </p>

          <h2>Chat assistant</h2>
          <p>
            The “Ask us” chat gives automated answers from the information on this website. It runs entirely in your browser: what you type
            is not sent to us or to anyone else. To keep the conversation while you move between pages, it is held in your browser’s session
            storage and deleted when you close the tab, or when you choose “Start a new conversation”. If you choose WhatsApp, a call or email
            from the chat, the message is only sent when you press send in that app.
          </p>

          <h2>How we use it</h2>
          <p>
            We use your details only to respond to your enquiry or application and to provide the services you ask for. We do not sell your
            information.
          </p>

          <h2>Cookies and analytics</h2>
          {site.gtmId ? (
            <p>
              With your consent, we use Google Tag Manager and analytics to understand how visitors use this site. These tools are loaded,
              and their cookies set, only after you choose “Accept analytics”. You can change your choice at any time using “Cookie
              settings” at the bottom of any page.
            </p>
          ) : (
            <p>This website does not use analytics or advertising cookies.</p>
          )}
          <p>Fonts and images are served from this website itself, not from third-party servers.</p>

          <h2>Your choices</h2>
          <p>
            You can ask us what information we hold about you, or ask us to correct or delete it, by emailing{' '}
            <a href={`mailto:${site.email}`}>{site.email}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
