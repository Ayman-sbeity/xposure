import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { track } from '../analytics';
import { getJson, postJson } from '../api';
import { campaignFromUrl } from '../attribution';
import { whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { prefersReducedMotion } from '../motion';
import { runtime } from '../runtime';
import { Required } from './ContactSection';
import { ArrowLeft, ArrowUpRight, CalendarDays, CalendarPlus, Clock, MessageCircle, Video } from './icons';

// BOOK A ZOOM MEETING. Free times come from the availability set in the admin panel
// (Meetings > Availability). The request appears in the admin panel, where the team confirms
// it with a Zoom link, or it is confirmed at once if automatic Zoom confirmation is on.

type Slots = { enabled: boolean; timezone: string; durationMinutes: number; days: { date: string; slots: string[] }[] };
type Booked = { id: number; status: 'pending' | 'confirmed'; start: string; end: string; joinUrl: string; timezone: string };
const TOPICS = ['questions', 'event', 'proposal', 'other'] as const;

/** A calendar file the visitor can open in Google Calendar, Outlook or Apple Calendar. */
function icsFile(booked: Booked, title: string): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Xposure//Meeting//EN',
    'BEGIN:VEVENT',
    `UID:meeting-${booked.id}@xposurelb.com`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(booked.start)}`,
    `DTEND:${stamp(booked.end)}`,
    `SUMMARY:${title}`,
    ...(booked.joinUrl ? [`LOCATION:${booked.joinUrl}`, `DESCRIPTION:Join on Zoom: ${booked.joinUrl}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function MeetingBooker() {
  const { t, locale } = useI18n();
  const m = t.meeting;
  const uid = useId();
  const [data, setData] = useState<Slots | null>(null);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [fields, setFields] = useState({ name: '', email: '', phone: '', company: '', topic: 'questions', message: '', website: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const [visitorZone, setVisitorZone] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  async function load() {
    setFailed(false);
    const result = await getJson<Slots>('/api/meetings/slots');
    if (!result.ok) return setFailed(true);
    setData(result.data);
    setDay((current) => (current && result.data.days.some((d) => d.date === current) ? current : (result.data.days[0]?.date ?? null)));
  }

  // Times are fetched in the browser (they change by the minute); the server-rendered page
  // shows the loading state, so the markup matches on hydration.
  useEffect(() => {
    if (!runtime.api) return;
    void load();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setVisitorZone(zone);
  }, []);

  // Keyboard and screen-reader users start at the top of each new step.
  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [slot, booked]);

  const lang = locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB';
  const zone = data?.timezone ?? 'Asia/Beirut';
  const fmt = (iso: string, options: Intl.DateTimeFormatOptions, timeZone = zone) => new Intl.DateTimeFormat(lang, { timeZone, ...options }).format(new Date(iso));
  const time = (iso: string, timeZone = zone) => fmt(iso, { hour: '2-digit', minute: '2-digit' }, timeZone);
  const longDate = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  const dayParts = (date: string) => {
    const iso = `${date}T12:00:00Z`;
    return { weekday: fmt(iso, { weekday: 'short' }, 'UTC'), number: fmt(iso, { day: 'numeric' }, 'UTC'), month: fmt(iso, { month: 'short' }, 'UTC') };
  };
  const showVisitorTime = Boolean(visitorZone && data && visitorZone !== data.timezone && time(new Date().toISOString(), visitorZone) !== time(new Date().toISOString()));
  const whatsapp = (
    <a className="button outline" href={whatsappLink(m.whatsappMessage)} target="_blank" rel="noopener noreferrer" onClick={() => track('contact_click', { method: 'whatsapp', location: 'meeting' })}>
      <MessageCircle size={18} /> {m.askWhatsApp}
    </a>
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot || sending) return;
    setSending(true);
    setError('');
    const result = await postJson<Booked>('/api/meetings', { start: slot, ...fields, locale, campaign: campaignFromUrl() ?? '' });
    setSending(false);
    if (result.ok) {
      moved.current = true;
      setBooked(result.data);
      track('generate_lead', { method: 'form', location: 'meeting' });
      return;
    }
    if (result.status === 409) {
      setError(m.errTaken);
      setSlot(null);
      void load();
    } else if (result.fields) setError(Object.values(result.fields).flat()[0] ?? m.errSend);
    else setError(m.errSend);
  }

  // ---- States without the booking form
  if (!runtime.api || failed)
    return (
      <div className="booker booker-message">
        <p>{m.unavailable}</p>
        {whatsapp}
      </div>
    );
  if (!data)
    return (
      <div className="booker booker-loading" aria-busy="true">
        <p className="booker-note">{m.loading}</p>
        <div className="booker-days">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="booker-day is-placeholder" />
          ))}
        </div>
      </div>
    );
  if (!data.enabled || !data.days.length)
    return (
      <div className="booker booker-message">
        <p>{data.enabled ? m.none : m.unavailable}</p>
        {whatsapp}
      </div>
    );

  if (booked) {
    const confirmed = booked.status === 'confirmed' && booked.joinUrl;
    const first = fields.name.split(' ')[0];
    return (
      <div className="booker planner-done">
        <svg className="planner-done-check" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="24" />
          <path d="M15 27.5l7 7 15-15" />
        </svg>
        <h2 ref={headingRef} tabIndex={-1}>
          {confirmed ? m.confirmedTitle : m.requestedTitle}
        </h2>
        <p role="status">{(confirmed ? m.confirmedText : m.requestedText).replace('{name}', first)}</p>
        <div className="booker-summary">
          <CalendarDays size={20} />
          <span>
            <strong>{longDate(booked.start)}</strong>
            <span>
              {time(booked.start)} – {time(booked.end)} · {m.timezone}
            </span>
          </span>
        </div>
        <div className="planner-done-actions">
          {confirmed && (
            <a className="button dark" href={booked.joinUrl} target="_blank" rel="noopener noreferrer">
              <Video size={18} /> {m.join}
            </a>
          )}
          {confirmed && (
            <a className="button outline" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFile(booked, m.calendarTitle))}`} download="xposure-meeting.ics">
              <CalendarPlus size={18} /> {m.addCalendar}
            </a>
          )}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setBooked(null);
              setSlot(null);
              void load();
            }}
          >
            {m.another}
          </button>
        </div>
      </div>
    );
  }

  const today = data.days.find((d) => d.date === day) ?? data.days[0];

  return (
    <div className="booker">
      {!slot ? (
        <div className="booker-step" data-dir="back">
          <p className="planner-count">1 / 2</p>
          <h2 ref={headingRef} tabIndex={-1}>
            {m.stepTime}
          </h2>
          <p className="booker-note">
            <Clock size={16} /> {m.minutes.replace('{n}', String(data.durationMinutes))} · {m.timezone}
          </p>
          {error && (
            <p className="planner-error" role="alert">
              {error}
            </p>
          )}
          <h3 className="booker-label" id={`${uid}-days`}>
            {m.days}
          </h3>
          <div className="booker-days" role="group" aria-labelledby={`${uid}-days`}>
            {data.days.map((d, i) => {
              const parts = dayParts(d.date);
              return (
                <button
                  key={d.date}
                  type="button"
                  className={d.date === today.date ? 'booker-day is-selected' : 'booker-day'}
                  aria-pressed={d.date === today.date}
                  onClick={() => setDay(d.date)}
                  style={{ '--i': i } as CSSProperties}
                >
                  <span>{parts.weekday}</span>
                  <strong>{parts.number}</strong>
                  <span>{parts.month}</span>
                </button>
              );
            })}
          </div>
          <h3 className="booker-label" id={`${uid}-times`}>
            {m.times.replace('{day}', longDate(`${today.date}T12:00:00Z`))}
          </h3>
          <ul className="booker-times" aria-labelledby={`${uid}-times`} key={today.date}>
            {today.slots.map((iso, i) => (
              <li key={iso} style={{ '--i': i } as CSSProperties}>
                <button
                  type="button"
                  className="booker-time"
                  onClick={() => {
                    moved.current = true;
                    setError('');
                    setSlot(iso);
                  }}
                >
                  <strong dir="ltr">{time(iso)}</strong>
                  {showVisitorTime && visitorZone && (
                    <span>
                      <span dir="ltr">{time(iso, visitorZone)}</span> {m.yourTime}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <form className="site-form booker-step" data-dir="forward" onSubmit={submit}>
          <p className="planner-count">2 / 2</p>
          <h2 ref={headingRef} tabIndex={-1}>
            {m.stepDetails}
          </h2>
          <div className="booker-summary">
            <CalendarDays size={20} />
            <span>
              <strong>{longDate(slot)}</strong>
              <span>
                <span dir="ltr">
                  {time(slot)} – {time(new Date(Date.parse(slot) + data.durationMinutes * 60000).toISOString())}
                </span>{' '}
                · {m.minutes.replace('{n}', String(data.durationMinutes))}
              </span>
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                moved.current = true;
                setSlot(null);
              }}
            >
              <ArrowLeft size={15} /> {m.change}
            </button>
          </div>
          <div className="form-row">
            <label>
              <span>
                {t.form.name} <Required />
              </span>
              <input required name="name" autoComplete="name" minLength={2} maxLength={100} value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} />
            </label>
            <label>
              <span>
                {t.form.email} <Required />
              </span>
              <input required type="email" name="email" autoComplete="email" maxLength={254} dir="ltr" value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t.form.phone}
              <input type="tel" name="phone" autoComplete="tel" maxLength={30} pattern="[+0-9 \(\)\-]*" title={t.form.phoneTitle} dir="ltr" value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} />
            </label>
            <label>
              {t.form.company}
              <input name="company" autoComplete="organization" maxLength={150} value={fields.company} onChange={(e) => setFields({ ...fields, company: e.target.value })} />
            </label>
          </div>
          <label>
            {m.topic}
            <select name="topic" value={fields.topic} onChange={(e) => setFields({ ...fields, topic: e.target.value })}>
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {m.topics[topic]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {m.message}
            <textarea name="message" rows={3} maxLength={2000} placeholder={m.messagePh} value={fields.message} onChange={(e) => setFields({ ...fields, message: e.target.value })} />
          </label>
          {/* Honeypot for bots; hidden from people and assistive technology. */}
          <div className="hp-field" aria-hidden="true">
            <label>
              {t.form.honeypot}
              <input name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={(e) => setFields({ ...fields, website: e.target.value })} />
            </label>
          </div>
          {error && (
            <p className="planner-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button className="button dark" type="submit" disabled={sending} aria-busy={sending || undefined}>
              {sending ? t.form.sending : m.submit} <ArrowUpRight size={18} />
            </button>
          </div>
          <p className="form-note">
            <span aria-hidden="true">*</span> {t.form.required} {m.privacy}{' '}
            <a href="/privacy/" hrefLang="en" className="note-link">
              {t.form.privacy}
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
