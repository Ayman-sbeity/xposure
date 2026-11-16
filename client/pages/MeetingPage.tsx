import { MeetingBooker } from '../components/MeetingBooker';
import { PageHero } from '../components/PageHero';
import { FaqSection } from '../components/Sections';
import { useI18n } from '../i18n';

/** /meeting/: book a Zoom call with the team. Share this link like /plan/. */
export function MeetingPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.meeting, path: '/meeting/' }]}
        eyebrow={t.meeting.eyebrow}
        title={t.meeting.title}
        accent={t.meeting.accent}
        lede={t.meeting.lede}
      />
      <section className="section booker-section" aria-label={t.meeting.label} data-hide-dock>
        <MeetingBooker />
      </section>
      <FaqSection />
    </>
  );
}
