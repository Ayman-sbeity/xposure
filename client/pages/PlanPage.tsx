import { BriefBuilder } from '../components/BriefBuilder';
import { PageHero } from '../components/PageHero';
import { FaqSection } from '../components/Sections';
import { useI18n } from '../i18n';

/**
 * /plan/: the event brief builder. A focused landing page: share this link in the Instagram
 * bio, ads and WhatsApp status (add ?utm_source=… to see which one brought each lead, and
 * ?service=<slug> or ?occasion=<key> to preselect an answer).
 */
export function PlanPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.plan, path: '/plan/' }]}
        eyebrow={t.plan.eyebrow}
        title={t.plan.title}
        accent={t.plan.accent}
        lede={t.plan.lede}
      />
      <section className="section planner-section" aria-label={t.plan.label} data-hide-dock>
        <BriefBuilder />
      </section>
      <FaqSection />
    </>
  );
}
