import { ArrowUpRight } from '../components/icons';
import { PageHero } from '../components/PageHero';
import { CtaBand } from '../components/Sections';
import { guides, type Guide } from '../content/guides';
import { findService } from '../content/services';

// Guides are English-only for now. Translate them once the Arabic site has been reviewed.

export function GuidesPage() {
  return (
    <>
      <PageHero
        trail={[{ name: 'Guides', path: '/guides/' }]}
        eyebrow="GUIDES"
        title="Plan your event"
        accent="with confidence."
        lede="Practical checklists from the Xposure team to help you brief, staff and run events and exhibition stands."
      />
      <section className="section other-services guide-index" aria-label="All guides">
        <ul>
          {guides.map((guide) => (
            <li key={guide.slug}>
              <a href={`/guides/${guide.slug}/`}>
                <span>
                  {guide.title}
                  <small>{guide.description}</small>
                </span>
                <ArrowUpRight size={20} />
              </a>
            </li>
          ))}
        </ul>
      </section>
      <CtaBand title="Planning something?" accent="Let’s make it happen." text="Tell us about your occasion and we’ll bring the right people to the conversation." />
    </>
  );
}

export function GuidePage({ guide }: { guide: Guide }) {
  return (
    <>
      {/* Reading progress: a CSS scroll-driven animation, so no JavaScript runs while reading. */}
      <div className="read-progress" aria-hidden="true" />
      <PageHero
        trail={[
          { name: 'Guides', path: '/guides/' },
          { name: guide.title, path: `/guides/${guide.slug}/` },
        ]}
        eyebrow="GUIDE"
        title={guide.title}
        accent={guide.accent}
        lede={guide.intro}
        accentOnNewLine
      />
      <article className="section legal guide">
        <div className="prose">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.list && (
                <ul>
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <h2>Related services</h2>
          <ul className="tag-list">
            {guide.relatedServices.map((slug) => {
              const service = findService(slug);
              return service ? (
                <li key={slug}>
                  <a href={`/services/${slug}/`}>{service.name}</a>
                </li>
              ) : null;
            })}
          </ul>
        </div>
      </article>
      <CtaBand title="Need people for your event?" accent="Send us your brief." text="Share your date, location and the roles you need. We’ll follow up to discuss the details." />
    </>
  );
}
