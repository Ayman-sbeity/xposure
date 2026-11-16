import { useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type FormEvent } from 'react';
import type { LucideProps } from 'lucide-react';
import { track } from '../analytics';
import { campaignLines } from '../attribution';
import { getServices } from '../content/services';
import { useI18n } from '../i18n';
import { en } from '../i18n/strings';
import { prefersReducedMotion } from '../motion';
import { site } from '../content/site';
import { runtime } from '../runtime';
import { deliver, FormActions, messageMeta, openDraft, Required, submittedChannel, type Channel } from './ContactSection';
import { ArrowLeft, ArrowUpRight, Briefcase, Check, Megaphone, PartyPopper, Sparkles, Store } from './icons';

// EVENT BRIEF BUILDER (/plan/). Four short steps instead of one long form: visitors answer
// a few easy questions first, which gets more people to the end. Like the enquiry form it is
// front-end only: the answers become a ready-written message (in English, for the team) that
// the visitor sends from WhatsApp or their email app. Nothing is stored by the website.

const OCCASIONS = ['corporate', 'exhibition', 'activation', 'celebration', 'other'] as const;
const GUESTS = ['u50', '50-150', '150-500', '500+', 'unsure'] as const;
const DURATIONS = ['hours', 'day', 'days'] as const;
type Occasion = (typeof OCCASIONS)[number];
type Guests = (typeof GUESTS)[number];
type Duration = (typeof DURATIONS)[number];

const ADVISE = 'advise';
const LAST = 3;

const occasionIcons: Record<Occasion, ComponentType<LucideProps>> = {
  corporate: Briefcase,
  exhibition: Store,
  activation: Megaphone,
  celebration: PartyPopper,
  other: Sparkles,
};

type Brief = {
  occasion: Occasion | null;
  /** English service names (as the enquiry form uses), or ADVISE. */
  services: string[];
  date: string;
  location: string;
  guests: Guests | null;
  duration: Duration | null;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
};

const emptyBrief: Brief = {
  occasion: null,
  services: [],
  date: '',
  location: '',
  guests: null,
  duration: null,
  name: '',
  company: '',
  phone: '',
  email: '',
  notes: '',
};

const isOccasion = (value: string | null): value is Occasion => OCCASIONS.includes(value as Occasion);
const delay = (i: number) => ({ '--i': i }) as CSSProperties;

/** The message sent to the team. Always English, whatever the page language. */
function briefMessage(brief: Brief): { subject: string; lines: string[] } {
  const e = en.plan;
  const tbc = 'To be confirmed';
  const occasion = brief.occasion ? e.occasions[brief.occasion] : 'Not specified';
  const services = brief.services.map((s) => (s === ADVISE ? 'Not sure yet, please advise' : s)).join(', ');
  const company = brief.company.trim();
  return {
    subject: `New event brief — ${occasion}`,
    lines: [
      'Hello Xposure,',
      '',
      `My name is ${brief.name.trim()}${company ? ` from ${company}` : ''}. Here is my event brief:`,
      '',
      `Occasion: ${occasion}`,
      `Services: ${services}`,
      `Event date: ${brief.date || tbc}`,
      `Location: ${brief.location.trim() || tbc}`,
      `Expected guests: ${brief.guests ? e.guestRanges[brief.guests] : tbc}`,
      `Duration: ${brief.duration ? e.durations[brief.duration] : tbc}`,
      ...(brief.phone.trim() ? [`Phone / WhatsApp: ${brief.phone.trim()}`] : []),
      ...(brief.email.trim() ? [`Email: ${brief.email.trim()}`] : []),
      ...(brief.notes.trim() ? ['', brief.notes.trim()] : []),
      ...campaignLines(),
    ],
  };
}

type ChoiceProps = {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  index: number;
  Icon?: ComponentType<LucideProps>;
  variant?: 'card' | 'chip';
};

/** A real radio/checkbox (keyboard and screen-reader support for free) styled as a card or chip. */
function Choice({ type, name, value, checked, onChange, label, index, Icon, variant = 'chip' }: ChoiceProps) {
  return (
    <label className={`choice choice-${variant}${checked ? ' is-checked' : ''}${value === ADVISE ? ' is-advise' : ''}`} style={delay(index)}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} />
      {Icon && (
        <span className="choice-icon">
          <Icon size={26} strokeWidth={1.6} />
        </span>
      )}
      <span className="choice-label">{label}</span>
      <span className="choice-tick">
        <Check size={13} strokeWidth={3} />
      </span>
    </label>
  );
}

export function BriefBuilder() {
  const { t, locale, href } = useI18n();
  const p = t.plan;
  const services = getServices(locale);
  const uid = useId();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState<Channel | 'saved' | null>(null);
  const [sending, setSending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  // Links such as /plan/?service=photo-marketing&occasion=exhibition preselect answers
  // (from service pages, ads or social posts). Read after hydration so markup matches.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('service');
    const match = slug ? getServices('en').find((s) => s.slug === slug) : undefined;
    const occasion = params.get('occasion');
    if (!match && !isOccasion(occasion)) return;
    setBrief((b) => ({
      ...b,
      services: match ? [match.name] : b.services,
      occasion: isOccasion(occasion) ? occasion : b.occasion,
    }));
  }, []);

  // After every step change, move focus to the new heading (keyboard and screen-reader users
  // start at the top of the step) and bring the builder back into view on small screens.
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [step, sent]);

  function update<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((b) => ({ ...b, [key]: value }));
    setError('');
  }

  function toggleService(name: string) {
    update('services', brief.services.includes(name) ? brief.services.filter((s) => s !== name) : [...brief.services, name]);
  }

  function goTo(next: number) {
    moved.current = true;
    setDirection(next > step ? 'forward' : 'back');
    setError('');
    setSent(null);
    setStep(next);
  }

  function advance() {
    const problem = step === 0 && !brief.occasion ? p.errOccasion : step === 1 && !brief.services.length ? p.errServices : '';
    if (problem) {
      setError(problem);
      setAttempt((n) => n + 1); // restarts the shake animation
      return;
    }
    track('brief_step', { step: step + 2, location: 'brief_builder' });
    goTo(step + 1);
  }

  function send(channel: Channel) {
    const { subject, lines } = briefMessage(brief);
    openDraft(channel, subject, lines);
  }

  /** The brief as the API stores it (English labels, for the team). */
  function payload() {
    const e = en.plan;
    return {
      type: 'brief',
      name: brief.name.trim(),
      email: brief.email.trim(),
      phone: brief.phone.trim(),
      company: brief.company.trim(),
      occasion: brief.occasion ? e.occasions[brief.occasion] : 'Not specified',
      services: brief.services.map((s) => (s === ADVISE ? 'Not sure yet, please advise' : s)),
      date: brief.date,
      location: brief.location.trim(),
      guests: brief.guests ? e.guestRanges[brief.guests] : '',
      duration: brief.duration ? e.durations[brief.duration] : '',
      notes: brief.notes.trim(),
      ...messageMeta(locale),
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter on steps 1–3 means "Continue".
    if (step < LAST) return advance();
    if (sending || String(new FormData(event.currentTarget).get('website') ?? '').trim()) return; // honeypot
    const channel = submittedChannel(event);
    const lead = { location: 'brief_builder', service: brief.services.join(', '), occasion: brief.occasion ?? undefined };

    if (runtime.api && channel === 'email') {
      // Sent straight to the team's inbox: they need a way to reply.
      if (!brief.email.trim() && !brief.phone.trim()) {
        setError(p.errContact);
        setAttempt((n) => n + 1);
        return;
      }
      setSending(true);
      setError('');
      const status = await deliver('email', payload(), briefMessage(brief));
      setSending(false);
      if (status === 'error') {
        setError(`${t.form.errSend} ${t.form.fallback.replace('{email}', site.email).replace('{phone}', site.phoneDisplay)}`);
        setAttempt((n) => n + 1);
        return;
      }
      moved.current = true;
      setSent('saved');
      track('generate_lead', { method: 'form', ...lead });
      return;
    }

    if (runtime.api) await deliver('whatsapp', payload(), briefMessage(brief));
    else send(channel);
    moved.current = true;
    setSent(channel);
    track('generate_lead', { method: channel === 'whatsapp' ? 'whatsapp' : 'email_draft', ...lead });
  }

  const fill = (text: string) => text.replace('{n}', String(step + 1)).replace('{total}', String(LAST + 1));
  const titles = [
    [p.occasionTitle, p.occasionHint],
    [p.servicesTitle, p.servicesHint],
    [p.detailsTitle, p.detailsHint],
    [p.contactTitle, p.contactHint],
  ];
  const [title, hint] = titles[step];
  const titleId = `${uid}-title`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const progress = sent ? 1 : (step + 1) / (LAST + 1);

  const serviceName = (english: string) =>
    english === ADVISE ? p.advise : (services.find((s) => s.enquiryName === english)?.name ?? english);
  // Each row of the review list; rows that start a step carry its "Change" link.
  const summary: { label: string; value: string; edit?: { step: number; name: string } }[] = [
    { label: p.steps[0], value: brief.occasion ? p.occasions[brief.occasion] : p.notSet, edit: { step: 0, name: p.steps[0] } },
    {
      label: p.steps[1],
      value: brief.services.map(serviceName).join(locale === 'ar' ? '، ' : ', ') || p.notSet,
      edit: { step: 1, name: p.steps[1] },
    },
    { label: t.form.date, value: brief.date || p.notSet, edit: { step: 2, name: p.steps[2] } },
    { label: p.location, value: brief.location.trim() || p.notSet },
    { label: p.guests, value: brief.guests ? p.guestRanges[brief.guests] : p.notSet },
    { label: p.duration, value: brief.duration ? p.durations[brief.duration] : p.notSet },
  ];

  return (
    <div className="planner" ref={rootRef}>
      <ol className="planner-steps" aria-label={p.label}>
        {p.steps.map((name, i) => {
          const done = sent !== null || i < step;
          const current = !sent && i === step;
          return (
            <li key={name} className={done ? 'is-done' : current ? 'is-current' : undefined} aria-current={current ? 'step' : undefined}>
              <span className="planner-dot" aria-hidden="true">
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className="planner-step-name">{name}</span>
            </li>
          );
        })}
      </ol>
      <div className="planner-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      {sent ? (
        <div className="planner-done" data-dir="forward">
          <svg className="planner-done-check" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27.5l7 7 15-15" />
          </svg>
          <h2 ref={headingRef} tabIndex={-1}>
            {sent === 'saved' ? p.sentTitle : p.doneTitle}
          </h2>
          <p role="status">{sent === 'saved' ? p.sentText : sent === 'whatsapp' ? p.doneWhatsApp : p.doneEmail}</p>
          {sent === 'saved' ? (
            <div className="planner-done-actions">
              <a className="button dark" href={href('/meeting/')}>
                {p.talkLink} <ArrowUpRight size={18} />
              </a>
              <a className="button outline" href={href('/')}>
                {t.crumbs.home}
              </a>
            </div>
          ) : (
          <div className="planner-done-actions">
            <button type="button" className="button dark" onClick={() => send(sent)}>
              {p.retry} <ArrowUpRight size={18} />
            </button>
            <button
              type="button"
              className="button outline"
              onClick={() => {
                const other: Channel = sent === 'whatsapp' ? 'email' : 'whatsapp';
                send(other);
                setSent(other);
              }}
            >
              {sent === 'whatsapp' ? t.channels.email : t.channels.whatsapp}
            </button>
            <button type="button" className="link-button" onClick={() => goTo(LAST)}>
              {p.editBrief}
            </button>
          </div>
          )}
        </div>
      ) : (
        <form className="site-form planner-form" onSubmit={submit} aria-labelledby={titleId}>
          <div key={step} className="planner-panel" data-dir={direction}>
            <p className="planner-count">{fill(p.stepOf)}</p>
            <h2 id={titleId} ref={headingRef} tabIndex={-1}>
              {title}
            </h2>
            <p className="planner-hint" id={hintId}>
              {hint}
            </p>

            {step === 0 && (
              <fieldset
                className="choices choices-cards"
                aria-labelledby={titleId}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                aria-invalid={error ? true : undefined}
              >
                {OCCASIONS.map((key, i) => (
                  <Choice
                    key={key}
                    type="radio"
                    name="occasion"
                    value={key}
                    checked={brief.occasion === key}
                    onChange={() => update('occasion', key)}
                    label={p.occasions[key]}
                    index={i}
                    Icon={occasionIcons[key]}
                    variant="card"
                  />
                ))}
              </fieldset>
            )}

            {step === 1 && (
              <fieldset
                className="choices"
                aria-labelledby={titleId}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                aria-invalid={error ? true : undefined}
              >
                {[...services.map((s) => ({ value: s.enquiryName, label: s.name })), { value: ADVISE, label: p.advise }].map((option, i) => (
                  <Choice
                    key={option.value}
                    type="checkbox"
                    name="services"
                    value={option.value}
                    checked={brief.services.includes(option.value)}
                    onChange={() => toggleService(option.value)}
                    label={option.label}
                    index={i}
                  />
                ))}
              </fieldset>
            )}

            {step === 2 && (
              <div className="planner-details">
                <div className="form-row">
                  <label>
                    {t.form.date}
                    <input type="date" name="date" value={brief.date} onChange={(e) => update('date', e.target.value)} />
                  </label>
                  <label>
                    {p.location}
                    <input
                      name="location"
                      autoComplete="address-level2"
                      maxLength={120}
                      placeholder={p.locationPh}
                      value={brief.location}
                      onChange={(e) => update('location', e.target.value)}
                    />
                  </label>
                </div>
                <fieldset className="choices">
                  <legend className="choices-title">{p.guests}</legend>
                  {GUESTS.map((key, i) => (
                    <Choice
                      key={key}
                      type="radio"
                      name="guests"
                      value={key}
                      checked={brief.guests === key}
                      onChange={() => update('guests', key)}
                      label={p.guestRanges[key]}
                      index={i}
                    />
                  ))}
                </fieldset>
                <fieldset className="choices">
                  <legend className="choices-title">{p.duration}</legend>
                  {DURATIONS.map((key, i) => (
                    <Choice
                      key={key}
                      type="radio"
                      name="duration"
                      value={key}
                      checked={brief.duration === key}
                      onChange={() => update('duration', key)}
                      label={p.durations[key]}
                      index={i + GUESTS.length}
                    />
                  ))}
                </fieldset>
              </div>
            )}

            {step === LAST && (
              <>
                <dl className="planner-summary" aria-label={p.summary}>
                  {summary.map(({ label, value, edit }, i) => (
                    <div key={label} style={delay(i)}>
                      <dt>{label}</dt>
                      <dd>
                        <span>{value}</span>
                        {edit && (
                          <button type="button" className="link-button" onClick={() => goTo(edit.step)} aria-label={`${p.edit}: ${edit.name}`}>
                            {p.edit}
                          </button>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="form-row">
                  <label>
                    <span>
                      {t.form.name} <Required />
                    </span>
                    <input required name="name" autoComplete="name" minLength={2} maxLength={100} value={brief.name} onChange={(e) => update('name', e.target.value)} />
                  </label>
                  <label>
                    {t.form.company}
                    <input name="company" autoComplete="organization" maxLength={150} value={brief.company} onChange={(e) => update('company', e.target.value)} />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    {t.form.phone}
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      maxLength={30}
                      pattern="[+0-9 \(\)\-]*"
                      title={t.form.phoneTitle}
                      dir="ltr"
                      value={brief.phone}
                      onChange={(e) => update('phone', e.target.value)}
                    />
                  </label>
                  <label>
                    {t.form.email}
                    <input type="email" name="email" autoComplete="email" maxLength={254} dir="ltr" value={brief.email} onChange={(e) => update('email', e.target.value)} />
                  </label>
                </div>
                <label>
                  {p.notes}
                  <textarea name="notes" rows={4} maxLength={4000} placeholder={p.notesPh} value={brief.notes} onChange={(e) => update('notes', e.target.value)} />
                </label>
                {/* Honeypot for bots; hidden from people and assistive technology. */}
                <div className="hp-field" aria-hidden="true">
                  <label>
                    {t.form.honeypot}
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
              </>
            )}

            {error && (
              <p className="planner-error" id={errorId} role="alert" key={attempt}>
                {error}
              </p>
            )}

            <div className="planner-nav">
              {step > 0 && (
                <button type="button" className="button outline planner-back" onClick={() => goTo(step - 1)}>
                  <ArrowLeft size={18} /> {p.back}
                </button>
              )}
              {step < LAST && (
                <button type="submit" className="button dark planner-next">
                  {p.next} <ArrowUpRight size={18} />
                </button>
              )}
            </div>
            {step === LAST && <FormActions status={sending ? 'sending' : 'idle'} noteId={`${uid}-note`} sendLabel={p.send} />}
          </div>
        </form>
      )}

      <p className="planner-alt">
        {p.prefer} <a href={href('/contact/')}>{p.preferLink}</a>
        {runtime.api && (
          <>
            <br />
            {p.talk} <a href={href('/meeting/')}>{p.talkLink}</a>
          </>
        )}
      </p>
    </div>
  );
}
