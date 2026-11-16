import { useState, type FormEvent } from 'react';
import { track } from '../analytics';
import { deliver, FormActions, messageMeta, Required, submittedChannel, type FormStatus } from '../components/ContactSection';
import { ArrowUpRight, Check } from '../components/icons';
import { PageHero } from '../components/PageHero';
import { Lines, SectionTitle } from '../components/Sections';
import { useI18n } from '../i18n';
import { en } from '../i18n/strings';
import { runtime } from '../runtime';

// The prepared message always uses the English role names, for the Xposure team.
const ROLE_VALUES = en.careers.roles.map(([name]) => name);

function ApplicationForm() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<FormStatus>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const form = event.currentTarget;
    const channel = submittedChannel(event);
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? '').trim();
    if (field('website')) return; // honeypot
    if (runtime.api && channel === 'email') setStatus('sending');
    const next = await deliver(
      channel,
      {
        type: 'application',
        name: field('name'),
        email: field('email'),
        phone: field('phone'),
        role: field('role'),
        city: field('city'),
        languages: field('languages'),
        experience: field('experience'),
        ...messageMeta(locale),
      },
      {
        subject: `Job application — ${field('role')}`,
        lines: [
          'Hello Xposure,',
          '',
          `I would like to apply to work with Xposure as: ${field('role')}.`,
          `Name: ${field('name')}`,
          `Email: ${field('email')}`,
          `Phone / WhatsApp: ${field('phone')}`,
          ...(field('city') ? [`City / area: ${field('city')}`] : []),
          ...(field('languages') ? [`Languages: ${field('languages')}`] : []),
          '',
          field('experience'),
        ],
      },
    );
    setStatus(next);
    if (next === 'sent') form.reset();
    if (next !== 'error') track('generate_lead', { method: 'application', service: field('role') });
  }

  return (
    <form className="site-form" onSubmit={submit} aria-describedby="application-note">
      <div className="form-row">
        <label>
          <span>
            {t.form.name} <Required />
          </span>
          <input required name="name" autoComplete="name" minLength={2} maxLength={100} />
        </label>
        <label>
          <span>
            {t.form.phone} <Required />
          </span>
          <input required type="tel" name="phone" autoComplete="tel" minLength={6} maxLength={30} pattern="[+0-9 \(\)\-]*" title={t.form.phoneTitle} dir="ltr" />
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
          {t.careers.city}
          <input name="city" autoComplete="address-level2" placeholder={t.careers.cityPh} maxLength={100} />
        </label>
      </div>
      <div className="form-row">
        <label>
          {t.careers.role}
          <select name="role" defaultValue={ROLE_VALUES[0]}>
            {t.careers.roles.map(([label], i) => (
              <option key={ROLE_VALUES[i]} value={ROLE_VALUES[i]}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.careers.languages}
          <input name="languages" placeholder={t.careers.languagesPh} maxLength={150} />
        </label>
      </div>
      <label>
        {t.careers.experience}
        <textarea name="experience" rows={5} placeholder={t.careers.experiencePh} maxLength={2000} />
      </label>
      <div className="hp-field" aria-hidden="true">
        <label>
          {t.form.honeypot}
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormActions status={status} noteId="application-note" sendLabel={t.careers.send} sentText={t.careers.statusSent} />
    </form>
  );
}

export function CareersPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHero
        trail={[{ name: t.crumbs.careers, path: '/careers/' }]}
        eyebrow={t.careers.eyebrow}
        title={t.careers.title}
        accent={t.careers.accent}
        lede={t.careers.lede}
        image="horeca"
      >
        <a className="button dark" href="#apply">
          {t.careers.cta} <ArrowUpRight size={20} />
        </a>
      </PageHero>

      <section className="section roles" aria-labelledby="roles-title">
        <div className="detail-grid">
          <div className="reveal">
            <h2 id="roles-title">
              <Lines lines={t.careers.rolesLines} accent={t.careers.rolesAccent} />
            </h2>
            <h3 className="list-title look-title">{t.careers.lookLabel}</h3>
            <ul className="check-list large light">
              {t.careers.look.map((item) => (
                <li key={item}>
                  <Check size={17} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ul className="role-list reveal">
            {t.careers.roles.map(([name, text]) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="apply" className="contact section" aria-labelledby="apply-title">
        <SectionTitle title={t.titles.apply} id="apply-title" />
        <p className="contact-lede">{t.careers.formLede}</p>
        <ApplicationForm />
      </section>
    </>
  );
}
