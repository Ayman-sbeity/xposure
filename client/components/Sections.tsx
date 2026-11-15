import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { track } from '../analytics';
import { getFaqs, type Faq } from '../content/faqs';
import { whatsappLink } from '../content/site';
import { approvedStats } from '../content/stats';
import { approvedLogos, approvedTestimonials } from '../content/trust';
import { useI18n } from '../i18n';
import type { Crumb } from '../seo';
import { CountUp } from './CountUp';
import { ArrowUpRight, Minus, Plus } from './icons';
import { Photo } from './Photo';

/** Position of a child in a `.stagger` group, so CSS can delay its entrance. */
export const staggerIndex = (i: number) => ({ '--i': i }) as CSSProperties;

export function SectionLabel({ index, children, reveal = true }: { index: string; children: ReactNode; reveal?: boolean }) {
  return (
    <div className={reveal ? 'section-label reveal' : 'section-label'}>
      <span>{index}</span>
      <span>{children}</span>
    </div>
  );
}

type Title = { light: string; bold: string; ghost: string };

/**
 * Centred section heading in the site style: a light word, a bold word, and a large
 * faint "ghost" word behind them. Example: OUR **STORY** over a pale "our story".
 */
export function SectionTitle({ title, id, level = 2 }: { title: Title; id?: string; level?: 1 | 2 }) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className="section-title reveal">
      <span className="ghost" aria-hidden="true">
        {title.ghost}
      </span>
      <Heading id={id}>
        {title.light} <strong>{title.bold}</strong>
      </Heading>
    </div>
  );
}

/** Heading text: plain lines separated by breaks, then the italic accent line. */
export function Lines({ lines, accent }: { lines: string[]; accent: string }) {
  return (
    <>
      {lines.map((line) => (
        <Fragment key={line}>
          {line}
          <br />
        </Fragment>
      ))}
      <span className="serif">{accent}</span>
    </>
  );
}

/** `trail` uses English paths; they are localized here. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const { t, href } = useI18n();
  const items = [{ name: t.crumbs.home, path: '/' }, ...trail];
  return (
    <nav className="breadcrumbs" aria-label={t.crumbs.label}>
      <ol>
        {items.map((crumb, i) => (
          <li key={crumb.path}>
            {i === items.length - 1 ? <span aria-current="page">{crumb.name}</span> : <a href={href(crumb.path)}>{crumb.name}</a>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ProcessSection() {
  const { t } = useI18n();
  return (
    <section className="process section" aria-labelledby="process-title">
      <SectionTitle title={t.titles.process} id="process-title" />
      <ol className="steps stagger">
        {t.process.steps.map(([title, text], i) => (
          <li key={title} style={staggerIndex(i)}>
            <span className="step-number">0{i + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** FAQ using native <details>: keyboard-accessible and every answer is in the HTML. */
export function FaqSection({ items }: { items?: Faq[] }) {
  const { t, locale } = useI18n();
  return (
    <section className="faq section" aria-labelledby="faq-title">
      <SectionTitle title={t.titles.faq} id="faq-title" />
      <div className="faq-list stagger">
        {(items ?? getFaqs(locale)).map((faq, i) => (
          <details key={faq.q} open={i === 0} style={staggerIndex(i)}>
            <summary>
              {faq.q}
              <Plus size={19} className="faq-plus" />
              <Minus size={19} className="faq-minus" />
            </summary>
            <p>{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CtaBand({ title, accent, text }: { title: string; accent: string; text: string }) {
  const { t, href } = useI18n();
  return (
    <section className="cta-band section" aria-labelledby="cta-title">
      <div>
        <h2 id="cta-title">
          <Lines lines={[title]} accent={accent} />
        </h2>
        <p>{text}</p>
      </div>
      <div className="cta-actions">
        <a className="button dark" href={href('/contact/')}>
          {t.common.startEnquiry} <ArrowUpRight size={20} />
        </a>
        <a
          className="text-link"
          href={whatsappLink(t.common.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('contact_click', { method: 'whatsapp', location: 'cta_band' })}
        >
          {t.common.chatWhatsApp} <ArrowUpRight size={18} />
        </a>
      </div>
    </section>
  );
}

/** Dark band promoting the /plan/ brief builder, with its four steps drawn as a timeline. */
export function PlanTeaser() {
  const { t, href } = useI18n();
  const p = t.plan;
  return (
    <section className="plan-teaser section" aria-labelledby="plan-teaser-title">
      <div className="plan-teaser-copy reveal">
        <span className="eyebrow">{p.teaserEyebrow}</span>
        <h2 id="plan-teaser-title">
          <Lines lines={[p.teaserTitle]} accent={p.teaserAccent} />
        </h2>
        <p>{p.teaserText}</p>
        <a className="button light" href={href('/plan/')}>
          {p.teaserCta} <ArrowUpRight size={18} />
        </a>
      </div>
      <ol className="plan-teaser-steps stagger">
        {p.steps.map((name, i) => (
          <li key={name} style={staggerIndex(i)}>
            <span className="plan-teaser-num" dir="ltr">
              0{i + 1}
            </span>
            <span>{name}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Key figures with a count-up. Renders nothing until a figure in content/stats.ts is approved. */
export function StatsBand() {
  const { t, locale } = useI18n();
  const items = approvedStats();
  if (!items.length) return null;
  return (
    <section className="stats section" aria-labelledby="stats-title">
      <SectionTitle title={t.titles.stats} id="stats-title" />
      <dl className="stats-grid stagger">
        {items.map((stat, i) => (
          // dt must come first in a <dl>; CSS shows the number above the label.
          <div key={stat.label.en} style={staggerIndex(i)}>
            <dt>{stat.label[locale]}</dt>
            <dd>
              <CountUp value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Client testimonials, and client logos grouped into tabs by category.
 * Renders nothing until at least one entry in content/trust.ts has been approved.
 */
export function TrustSection() {
  const { t, locale } = useI18n();
  const quotes = approvedTestimonials();
  const logos = approvedLogos();
  const categories = [...new Set(logos.map((logo) => logo.category.en))];
  const [tab, setTab] = useState(0);
  if (!quotes.length && !logos.length) return null;
  const current = categories[Math.min(tab, categories.length - 1)];
  return (
    <section className="trust section" aria-labelledby="trust-title">
      <SectionTitle title={t.titles.clients} id="trust-title" />
      {logos.length > 0 && (
        <>
          {categories.length > 1 && (
            <div className="client-tabs" role="group" aria-label={t.trust.clientsTitle}>
              {categories.map((category, i) => (
                <button key={category} type="button" aria-pressed={category === current} className={category === current ? 'active' : ''} onClick={() => setTab(i)}>
                  {logos.find((logo) => logo.category.en === category)?.category[locale]}
                </button>
              ))}
            </div>
          )}
          <ul className="logos reveal">
            {logos
              .filter((logo) => logo.category.en === current)
              .map((client) => (
                <li key={client.name}>
                  <Photo name={client.logo} alt={client.name} />
                </li>
              ))}
          </ul>
        </>
      )}
      {quotes.length > 0 && (
        <div className="quotes reveal">
          {quotes.map((item) => {
            const translated = locale === 'ar' && item.quote.ar;
            return (
              <figure key={item.name}>
                <blockquote lang={translated ? 'ar' : 'en'} dir={translated ? 'rtl' : 'ltr'}>
                  <p>{translated ? item.quote.ar : item.quote.en}</p>
                </blockquote>
                <figcaption>
                  <strong>{item.name}</strong>
                  <span>
                    {item.role[locale]}, {item.company}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
