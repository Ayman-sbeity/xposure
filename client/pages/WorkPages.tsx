import { CountUp, parseFigure } from '../components/CountUp';
import { ArrowUpRight, Check } from '../components/icons';
import { PageHero } from '../components/PageHero';
import { Photo } from '../components/Photo';
import { CtaBand, SectionLabel, TrustSection } from '../components/Sections';
import { WorkGrid } from '../components/WorkGrid';
import { assetUrl } from '../content/assets';
import { getProjects } from '../content/projects';
import { getServices } from '../content/services';
import { useI18n } from '../i18n';
import { NotFoundPage } from './InfoPages';

export function WorkPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.work, path: '/work/' }]}
        eyebrow={t.work.pageEyebrow}
        title={t.work.pageTitle}
        accent={t.work.pageAccent}
        lede={t.work.pageLede}
      />
      <section className="work section" aria-labelledby="work-title">
        <WorkGrid
          heading={
            <h2 id="work-title" className="visually-hidden">
              {t.work.projects}
            </h2>
          }
        />
      </section>
      <TrustSection />
      <CtaBand title={t.work.ctaTitle} accent={t.work.ctaAccent} text={t.work.ctaText} />
    </>
  );
}

export function ProjectPage({ slug }: { slug: string }) {
  const { t, href, locale } = useI18n();
  const projects = getProjects(locale);
  const index = projects.findIndex((p) => p.slug === slug);
  if (index < 0) return <NotFoundPage />;
  const project = projects[index];
  const next = projects[(index + 1) % projects.length];
  const services = getServices(locale);
  // Only figures the client has confirmed are ever shown.
  const results = project.results.filter((result) => result.approved);
  return (
    <>
      <PageHero
        trail={[
          { name: t.crumbs.work, path: '/work/' },
          { name: project.client, path: `/work/${project.slug}/` },
        ]}
        eyebrow={`${t.work.filters[project.type].toUpperCase()} / ${project.year}`}
        title={project.client}
        accent={project.title}
        lede={project.summary}
        image={project.cover}
        accentOnNewLine
      />

      {results.length > 0 && (
        <section className="results section" aria-labelledby="results-title">
          <h2 id="results-title" className="small-heading">
            {t.work.results}
          </h2>
          <dl>
            {results.map((result) => {
              const figure = parseFigure(result.value);
              return (
                <div key={result.label.en}>
                  <dt>{result.label[locale]}</dt>
                  <dd dir="ltr">{figure ? <CountUp {...figure} /> : result.value}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}

      <section className="section project-story" aria-labelledby="story-title">
        <SectionLabel index={t.work.theProject}>
          <time dateTime={project.date}>{project.year}</time>
        </SectionLabel>
        <div className="detail-grid">
          <div className="prose reveal">
            <h2 id="story-title" className="small-heading">
              {t.work.story}
            </h2>
            {project.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <aside className="project-facts reveal" aria-labelledby="delivered-title">
            <h2 id="delivered-title" className="list-title">
              {t.work.delivered}
            </h2>
            <ul className="check-list large">
              {project.delivered.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
            <h2 className="list-title">{t.work.involved}</h2>
            <ul className="tag-list">
              {project.services.map((serviceSlug) => {
                const service = services.find((s) => s.slug === serviceSlug);
                return service ? (
                  <li key={serviceSlug}>
                    <a href={href(`/services/${serviceSlug}/`)}>{service.name}</a>
                  </li>
                ) : null;
              })}
            </ul>
          </aside>
        </div>
        {project.video && (
          <figure className="project-video reveal">
            <figcaption className="small-heading">{t.work.video}</figcaption>
            {/* preload="none": the video file is only downloaded when the visitor presses play. */}
            <video controls playsInline preload="none" poster={assetUrl(project.video.poster)} aria-label={project.video.title[locale]}>
              <source src={project.video.src} type="video/mp4" />
            </video>
          </figure>
        )}
        {project.gallery.length > 0 && (
          <div className="gallery reveal">
            {project.gallery.map((image) => (
              <Photo key={image} name={image} />
            ))}
          </div>
        )}
      </section>

      {next.slug !== project.slug && (
        <section className="section next-project" aria-label={t.work.nextAria}>
          <a href={href(`/work/${next.slug}/`)}>
            <span className="eyebrow">{t.work.next}</span>
            <span className="next-title">
              {next.client} <ArrowUpRight size={28} />
            </span>
          </a>
        </section>
      )}

      <CtaBand title={t.work.similarTitle} accent={t.work.similarAccent} text={t.work.similarText} />
    </>
  );
}
