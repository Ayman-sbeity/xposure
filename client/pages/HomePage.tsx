import type { CSSProperties } from 'react';
import { ContactSection } from '../components/ContactSection';
import { HeroSlider } from '../components/HeroSlider';
import { ArrowUpRight } from '../components/icons';
import { Marquee } from '../components/Marquee';
import { Photo } from '../components/Photo';
import { FaqSection, PlanTeaser, ProcessSection, SectionTitle, StatsBand, TrustSection, staggerIndex } from '../components/Sections';
import { WorkGrid } from '../components/WorkGrid';
import { circleTints } from '../content/home';
import { getServices } from '../content/services';
import { useI18n } from '../i18n';

/** Round, colour-washed service photos. Colours come from client/content/home.ts. */
export function ServiceCircles() {
  const { href, locale } = useI18n();
  return (
    <ul className="circles stagger">
      {getServices(locale).map((service, i) => (
        <li key={service.slug} style={staggerIndex(i)}>
          <a href={href(`/services/${service.slug}/`)} style={{ '--tint': circleTints[i % circleTints.length] } as CSSProperties}>
            <span className="circle">
              <Photo name={service.image} alt="" />
              <span className="circle-name">{service.name}</span>
            </span>
            <span className="circle-text">{service.details.join(' · ')}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { t, href, locale } = useI18n();
  const services = getServices(locale);
  // Row 1: what we do. Row 2: who it is for (the "ideal for" lists of the services).
  const marqueeRows = [services.map((s) => s.name), [...new Set(services.flatMap((s) => s.idealFor))].slice(0, 8)];
  return (
    <>
      <HeroSlider />
      <Marquee rows={marqueeRows} />

      <section className="story section" id="about" aria-labelledby="story-title">
        <SectionTitle title={t.titles.story} id="story-title" />
        <p className="story-text reveal">{t.story.text}</p>
        <a className="button dark" href={href('/about/')}>
          {t.story.more} <ArrowUpRight size={18} />
        </a>
      </section>

      <StatsBand />

      <section className="section" id="services" aria-labelledby="services-title">
        <SectionTitle title={t.titles.services} id="services-title" />
        <ServiceCircles />
      </section>

      <section className="work section" id="work" aria-labelledby="work-title">
        <WorkGrid heading={<SectionTitle title={t.titles.work} id="work-title" />} />
      </section>

      <TrustSection />
      <ProcessSection />
      <PlanTeaser />
      <FaqSection />
      <ContactSection />
    </>
  );
}

/** Photo + "approach" card used on the about page. */
export function AboutBottom({ photo }: { photo: 'team' | 'hostesses' }) {
  const { t } = useI18n();
  return (
    <div className="about-bottom reveal">
      <div className="about-picture">
        <Photo name={photo} />
        <span aria-hidden="true">{t.about.caption}</span>
      </div>
      <div className="approach">
        <span className="asterisk" aria-hidden="true">
          ✳
        </span>
        <h3>
          {t.about.approach[0]}
          <br />
          {t.about.approach[1]}
        </h3>
        <p>{t.about.approachText}</p>
        <span className="small-note">{t.about.note}</span>
      </div>
    </div>
  );
}
