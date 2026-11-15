import { track } from '../analytics';
import { ContactSection } from '../components/ContactSection';
import { ArrowUpRight, Check } from '../components/icons';
import { PageHero } from '../components/PageHero';
import { Photo } from '../components/Photo';
import { Lines, PlanTeaser, ProcessSection, SectionLabel } from '../components/Sections';
import { getProjects } from '../content/projects';
import { getServices } from '../content/services';
import { whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { NotFoundPage } from './InfoPages';

export function ServicesPage() {
  const { t, href, locale } = useI18n();
  const lower = (name: string) => (locale === 'en' ? name.toLowerCase() : name);
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.services, path: '/services/' }]}
        eyebrow={t.services.indexEyebrow}
        title={t.services.indexTitle}
        accent={t.services.indexAccent}
        lede={t.services.indexLede}
      >
        <a className="button dark" href={href('/contact/')}>
          {t.common.requestProposal} <ArrowUpRight size={20} />
        </a>
      </PageHero>

      <section className="service-index section" aria-label={t.services.all}>
        {getServices(locale).map((service, i) => (
          <article className="service-row reveal" key={service.slug} aria-labelledby={`svc-${service.slug}`}>
            <a className="service-row-image" href={href(`/services/${service.slug}/`)} tabIndex={-1} aria-hidden="true">
              <Photo name={service.image} />
            </a>
            <div className="service-row-copy">
              <span className="service-num">0{i + 1}</span>
              <span className="eyebrow">{service.tag}</span>
              <h2 id={`svc-${service.slug}`}>
                <a href={href(`/services/${service.slug}/`)}>{service.name}</a>
              </h2>
              <p>{service.summary}</p>
              <ul className="check-list">
                {service.details.map((detail) => (
                  <li key={detail}>
                    <Check size={15} />
                    {detail}
                  </li>
                ))}
              </ul>
              <a className="text-link" href={href(`/services/${service.slug}/`)}>
                {t.common.explore} {lower(service.name)} <ArrowUpRight size={19} />
              </a>
            </div>
          </article>
        ))}
      </section>

      <ProcessSection />
      <PlanTeaser />
      <ContactSection />
    </>
  );
}

export function ServicePage({ slug }: { slug: string }) {
  const { t, href, locale } = useI18n();
  const services = getServices(locale);
  const service = services.find((s) => s.slug === slug);
  if (!service) return <NotFoundPage />;
  const project = service.relatedProject ? getProjects(locale).find((p) => p.slug === service.relatedProject) : undefined;
  const lower = (name: string) => (locale === 'en' ? name.toLowerCase() : name);
  return (
    <>
      <PageHero
        trail={[
          { name: t.crumbs.services, path: '/services/' },
          { name: service.name, path: `/services/${service.slug}/` },
        ]}
        eyebrow={service.tag}
        title={service.heading.main}
        accent={service.heading.accent}
        lede={service.intro}
        image={service.image}
      >
        <a className="button dark" href="#contact">
          {t.common.requestProposal} <ArrowUpRight size={20} />
        </a>
        <a
          className="text-link"
          href={whatsappLink(`${t.common.whatsappAbout} ${lower(service.name)}.`)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('contact_click', { method: 'whatsapp', location: 'service_hero', service: service.enquiryName })}
        >
          {t.common.askWhatsApp} <ArrowUpRight size={18} />
        </a>
      </PageHero>

      <section className="services section" aria-labelledby="included-title">
        <SectionLabel index={t.services.included}>{service.name.toUpperCase()}</SectionLabel>
        <div className="detail-grid">
          <div className="reveal">
            <h2 id="included-title">
              <Lines lines={t.services.howLines} accent={t.services.howAccent} />
            </h2>
            <div className="prose">
              {service.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
          <div className="reveal">
            <h3 className="list-title">{t.services.covers}</h3>
            <ul className="check-list large">
              {service.details.map((detail) => (
                <li key={detail}>
                  <Check size={17} />
                  {detail}
                </li>
              ))}
            </ul>
            <h3 className="list-title">{t.services.idealFor}</h3>
            <ul className="tag-list">
              {service.idealFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="brief section" aria-labelledby="brief-title">
        <SectionLabel index={t.services.briefLabel}>{t.services.briefRight}</SectionLabel>
        <div className="detail-grid">
          <h2 className="reveal" id="brief-title">
            <Lines lines={t.services.briefLines} accent={t.services.briefAccent} />
          </h2>
          <ol className="brief-list reveal">
            {t.services.brief.map((item, i) => (
              <li key={item}>
                <span className="step-number">0{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {project && (
        <section className="section related" aria-labelledby="related-title">
          <SectionLabel index={t.services.inPractice}>{t.services.fromPortfolio}</SectionLabel>
          <a className="related-card reveal" href={href(`/work/${project.slug}/`)}>
            <Photo name={project.cover} />
            <div>
              <span className="eyebrow">
                {t.work.filters[project.type]} / {project.year}
              </span>
              <h2 id="related-title">{project.client}</h2>
              <p>{project.summary}</p>
              <span className="text-link">
                {t.common.viewProject} <ArrowUpRight size={18} />
              </span>
            </div>
          </a>
        </section>
      )}

      <section className="section other-services" aria-labelledby="other-title">
        <h2 id="other-title" className="small-heading">
          {t.services.other}
        </h2>
        <ul>
          {services
            .filter((s) => s.slug !== service.slug)
            .map((s) => (
              <li key={s.slug}>
                <a href={href(`/services/${s.slug}/`)}>
                  {s.name} <ArrowUpRight size={20} />
                </a>
              </li>
            ))}
        </ul>
      </section>

      <ContactSection defaultService={service.enquiryName} />
    </>
  );
}
