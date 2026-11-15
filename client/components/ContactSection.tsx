import { useEffect, useState, type FormEvent } from 'react';
import { track } from '../analytics';
import { campaignLines } from '../attribution';
import { getServices } from '../content/services';
import { site, whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { ArrowUpRight, Mail, MessageCircle, Phone } from './icons';
import { SectionTitle } from './Sections';

// FRONT-END ONLY: this website has no server. A form builds a ready-written message and
// opens it in the visitor's email app or WhatsApp; the visitor presses send there.
// Nothing typed into a form is stored or transmitted by the website itself.

export type Channel = 'email' | 'whatsapp';
export type FormStatus = 'idle' | Channel;

/** Which of the two submit buttons was pressed. */
export function submittedChannel(event: FormEvent<HTMLFormElement>): Channel {
  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
  return submitter?.value === 'whatsapp' ? 'whatsapp' : 'email';
}

/** Opens the prepared message. Messages are written in English for the Xposure team. */
export function openDraft(channel: Channel, subject: string, lines: string[]): void {
  const body = lines.join('\n');
  if (channel === 'whatsapp') {
    const url = whatsappLink(`${subject}\n\n${body}`);
    if (!window.open(url, '_blank', 'noopener')) window.location.href = url;
  } else {
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}

export function Required() {
  return (
    <span className="required" aria-hidden="true">
      *
    </span>
  );
}

/** The two send buttons, the explanatory note and the polite status message. */
export function FormActions({ status, noteId }: { status: FormStatus; noteId: string }) {
  const { t } = useI18n();
  return (
    <>
      <div className="form-actions">
        <button className="button dark" type="submit" name="channel" value="email">
          <Mail size={18} /> {t.channels.email}
        </button>
        <button className="button outline" type="submit" name="channel" value="whatsapp">
          <MessageCircle size={18} /> {t.channels.whatsapp}
        </button>
      </div>
      <p className="form-note" id={noteId}>
        <span aria-hidden="true">*</span> {t.form.required} {t.channels.note}{' '}
        <a href="/privacy/" hrefLang="en" className="note-link">
          {t.form.privacy}
        </a>
      </p>
      <div aria-live="polite" role="status">
        {status === 'email' && <p className="form-status">{t.channels.statusEmail}</p>}
        {status === 'whatsapp' && <p className="form-status">{t.channels.statusWhatsApp}</p>}
      </div>
    </>
  );
}

function EnquiryForm({ defaultService }: { defaultService: string }) {
  const { t, locale } = useI18n();
  const services = getServices(locale);
  const [service, setService] = useState(defaultService);
  const [status, setStatus] = useState<FormStatus>('idle');

  // Links such as /contact/?service=photo-marketing preselect the service.
  // Read after hydration so server and client markup match.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('service');
    const match = slug ? getServices('en').find((s) => s.slug === slug) : undefined;
    if (match) setService(match.name);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const channel = submittedChannel(event);
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? '').trim();
    if (field('website')) return; // honeypot: a bot filled the hidden field
    openDraft(channel, `New event enquiry — ${field('service')}`, [
      'Hello Xposure,',
      '',
      `My name is ${field('name')} from ${field('company') || 'our team'}.`,
      `Email: ${field('email')}`,
      ...(field('phone') ? [`Phone / WhatsApp: ${field('phone')}`] : []),
      `Service: ${field('service')}`,
      `Event date: ${field('date') || 'To be confirmed'}`,
      '',
      field('message'),
      ...campaignLines(),
    ]);
    setStatus(channel);
    track('generate_lead', { method: channel === 'whatsapp' ? 'whatsapp' : 'email_draft', service: field('service') });
  }

  return (
    <form className="site-form" onSubmit={submit} aria-describedby="form-note">
      <div className="form-row">
        <label>
          <span>
            {t.form.name} <Required />
          </span>
          <input required name="name" autoComplete="name" minLength={2} maxLength={100} />
        </label>
        <label>
          {t.form.phone}
          <input type="tel" name="phone" autoComplete="tel" maxLength={30} pattern="[+0-9 \(\)\-]*" title={t.form.phoneTitle} dir="ltr" />
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>
            {t.form.email} <Required />
          </span>
          <input required type="email" name="email" autoComplete="email" maxLength={254} dir="ltr" />
        </label>
        <label>
          {t.form.company}
          <input name="company" autoComplete="organization" maxLength={150} />
        </label>
      </div>
      <div className="form-row">
        <label>
          {t.form.service}
          <select name="service" value={service} onChange={(e) => setService(e.target.value)}>
            {services.map((s) => (
              <option key={s.slug} value={s.enquiryName}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.form.date}
          <input type="date" name="date" />
        </label>
      </div>
      <label>
        <span>
          {t.form.message} <Required />
        </span>
        <textarea required name="message" rows={5} placeholder={t.form.messagePh} minLength={10} maxLength={4000} />
      </label>
      {/* Honeypot for bots; hidden from people and assistive technology. */}
      <div className="hp-field" aria-hidden="true">
        <label>
          {t.form.honeypot}
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormActions status={status} noteId="form-note" />
    </form>
  );
}

type ContactSectionProps = {
  /** Use 1 on the contact page so it owns the page h1. */
  headingLevel?: 1 | 2;
  /** English service name preselected in the form. */
  defaultService?: string;
};

export function ContactSection({ headingLevel = 2, defaultService = 'Event coordination' }: ContactSectionProps) {
  const { t, locale } = useI18n();
  return (
    <section id="contact" className="contact section" aria-labelledby="contact-title" data-hide-dock>
      <SectionTitle title={t.titles.contact} id="contact-title" level={headingLevel} />
      <p className="contact-lede">
        {t.contact.lede[0]} {t.contact.lede[1]}
      </p>
      {site.responsePromise && <p className="promise">{site.responsePromise[locale]}</p>}
      <EnquiryForm defaultService={defaultService} />
      <ul className="contact-ways">
        <li>
          <a href={`mailto:${site.email}`} onClick={() => track('contact_click', { method: 'email', location: 'contact' })}>
            <Mail size={18} /> {site.email}
          </a>
        </li>
        <li>
          <a href={`tel:${site.phone}`} onClick={() => track('contact_click', { method: 'phone', location: 'contact' })}>
            <Phone size={18} /> <span dir="ltr">{site.phoneDisplay}</span>
          </a>
        </li>
        <li>
          <a
            href={whatsappLink(t.common.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('contact_click', { method: 'whatsapp', location: 'contact' })}
          >
            <MessageCircle size={18} /> WhatsApp
          </a>
        </li>
        {site.companyProfilePdf && (
          <li>
            <a href={site.companyProfilePdf} download onClick={() => track('file_download', { file: 'company_profile', location: 'contact' })}>
              <ArrowUpRight size={18} /> {t.contact.profile}
            </a>
          </li>
        )}
      </ul>
      {site.streetAddress && (
        <address className="visit">
          <strong>{t.contact.visit}</strong>
          <span>
            {site.streetAddress}, {t.common.location}
          </span>
          {site.openingHours && (
            <span>
              {t.contact.hours}: <span dir="ltr">{site.openingHours.map((h) => `${h.days} ${h.opens}–${h.closes}`).join(', ')}</span>
            </span>
          )}
          {site.googleMapsUrl && (
            <a href={site.googleMapsUrl} target="_blank" rel="noopener noreferrer">
              {t.contact.map} <ArrowUpRight size={14} />
            </a>
          )}
        </address>
      )}
    </section>
  );
}
