import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Settings2,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { api, ApiError, type BookingResponse, type BookingSettings, type Meeting, type MeetingList } from '../api';
import { Link } from '../router';
import {
  Avatar,
  Badge,
  Button,
  Card,
  cx,
  dayKey,
  EmptyState,
  ErrorNote,
  formatDate,
  formatDateTime,
  formatTime,
  PageHeader,
  plural,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  TextArea,
  TextInput,
  timeAgo,
  timeZone,
  Toggle,
  useApi,
  useConfirm,
  useCopy,
  useToast,
  whatsappNumber,
} from '../ui';

type View = 'upcoming' | 'pending' | 'past' | 'all';
export const TOPICS: Record<string, string> = {
  questions: 'General questions',
  event: 'Planning a specific event',
  proposal: 'Discussing a proposal',
  other: 'Something else',
};

export function Meetings({ id, zoom }: { id: number | null; zoom: boolean }) {
  const [view, setView] = useState<View>('upcoming');
  const list = useApi<MeetingList>(`/meetings?view=${view}`);
  const copy = useCopy();
  const groups = new Map<string, Meeting[]>();
  for (const meeting of list.data?.items ?? []) {
    const key = dayKey(meeting.start_at);
    groups.set(key, [...(groups.get(key) ?? []), meeting]);
  }

  return (
    <div className={cx('page split-page', id !== null && 'has-detail')}>
      <PageHeader
        title="Meetings"
        subtitle={`Zoom meetings booked from the website. Times are in ${timeZone().replace('_', ' ')} time.`}
        actions={
          <>
            <Button icon={<Link2 size={16} />} onClick={() => copy(`${window.location.origin}/meeting/`, 'Booking link copied')}>
              Copy booking link
            </Button>
            <Link className="btn btn-primary" to="/meetings/availability">
              <Settings2 size={16} aria-hidden="true" />
              <span>Availability</span>
            </Link>
          </>
        }
      />
      {!zoom && (
        <div className="alert is-info">
          <Video size={18} aria-hidden="true" />
          <span>
            Zoom is not connected yet, so paste a meeting link when you confirm a request. <Link to="/settings">Connect Zoom</Link> to create links in one click.
          </span>
        </div>
      )}
      <div className="toolbar">
        <Tabs<View>
          label="Meeting views"
          value={view}
          onChange={setView}
          items={[
            { value: 'upcoming', label: 'Upcoming', count: list.data?.counts.upcoming },
            { value: 'pending', label: 'Requests', count: list.data?.counts.pending },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      <div className="split">
        <section className="split-list card" aria-label="Meetings">
          {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
          {list.loading && !list.data ? (
            <div className="card-body">
              <Skeleton lines={6} />
            </div>
          ) : groups.size ? (
            <div>
              {[...groups].map(([day, meetings]) => (
                <div key={day} className="day-group">
                  <h3 className="day-heading">{formatDate(meetings[0].start_at)}</h3>
                  <ul className="message-list">
                    {meetings.map((meeting) => (
                      <li key={meeting.id}>
                        <Link to={`/meetings/${meeting.id}`} className={cx('message-row', meeting.id === id && 'is-selected')}>
                          <span className="time-chip">
                            <strong>{formatTime(meeting.start_at)}</strong>
                            <span>{formatTime(meeting.end_at)}</span>
                          </span>
                          <span className="message-row-main">
                            <span className="message-row-top">
                              <strong>{meeting.name}</strong>
                              <StatusPill status={meeting.status} />
                            </span>
                            <span className="message-row-preview">
                              {TOPICS[meeting.topic] ?? meeting.topic}
                              {meeting.company ? ` · ${meeting.company}` : ''}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarClock size={22} />}
              title={view === 'pending' ? 'No requests waiting' : view === 'past' ? 'No past meetings' : 'No meetings booked'}
              text="Share your booking page (/meeting/) so clients can pick a time for a Zoom call."
            />
          )}
        </section>
        <section className="split-detail" aria-label="Meeting">
          {id ? (
            <MeetingDetail key={id} id={id} zoom={zoom} onChange={list.reload} />
          ) : (
            <div className="card split-placeholder">
              <EmptyState icon={<CalendarCheck2 size={22} />} title="Select a meeting" text="Confirm requests, add the Zoom link and send the confirmation." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function confirmationText(m: Meeting): string {
  const when = new Intl.DateTimeFormat(m.locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { timeZone: timeZone(), weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(
    new Date(m.start_at),
  );
  const first = m.name.split(' ')[0];
  return m.locale === 'ar'
    ? `مرحباً ${first}،\n\nتم تأكيد اجتماعك مع Xposure يوم ${when} (بتوقيت بيروت).\nرابط الانضمام عبر Zoom:\n${m.join_url}\n\nإلى اللقاء!\nفريق Xposure`
    : `Hello ${first},\n\nYour meeting with Xposure is confirmed for ${when} (Beirut time).\nJoin on Zoom:\n${m.join_url}\n\nSee you then!\nThe Xposure team`;
}

function MeetingDetail({ id, zoom, onChange }: { id: number; zoom: boolean; onChange: () => void }) {
  const list = useApi<MeetingList>('/meetings?view=all');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [link, setLink] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopy();

  useEffect(() => {
    const found = list.data?.items.find((m) => m.id === id) ?? null;
    setMeeting(found);
    setLink(found?.join_url ?? '');
  }, [list.data, id]);

  if (list.error) return <ErrorNote message={list.error} />;
  if (!meeting)
    return list.loading ? (
      <div className="card card-body">
        <Skeleton lines={8} />
      </div>
    ) : (
      <div className="card">
        <EmptyState icon={<CalendarX2 size={22} />} title="Meeting not found" action={<Link to="/meetings">Back to meetings</Link>} />
      </div>
    );
  const m = meeting;

  async function update(body: Record<string, string>, success: string) {
    setBusy(Object.keys(body)[0]);
    try {
      const result = await api<{ meeting: Meeting }>(`/meetings/${id}`, { method: 'PATCH', body });
      setMeeting(result.meeting);
      setLink(result.meeting.join_url);
      onChange();
      toast({ tone: 'success', text: success });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not update the meeting.' });
    } finally {
      setBusy('');
    }
  }

  async function createZoom() {
    setBusy('zoom');
    try {
      const result = await api<{ meeting: Meeting }>(`/meetings/${id}/zoom`, { method: 'POST' });
      setMeeting(result.meeting);
      setLink(result.meeting.join_url);
      onChange();
      toast({ tone: 'success', text: 'Zoom meeting created and confirmed. Now send the confirmation.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Zoom could not create the meeting.' });
    } finally {
      setBusy('');
    }
  }

  async function cancel() {
    if (!(await confirm({ title: 'Cancel this meeting?', text: `The time slot becomes free again. Let ${m.name} know with the buttons that follow.`, confirm: 'Cancel meeting', danger: true }))) return;
    await update({ status: 'cancelled' }, 'Meeting cancelled. Let the client know.');
  }

  const first = m.name.split(' ')[0];
  const text = confirmationText({ ...m, join_url: link });
  const cancelText =
    m.locale === 'ar'
      ? `مرحباً ${first}،\n\nنعتذر، اضطررنا إلى إلغاء اجتماعنا يوم ${formatDateTime(m.start_at)}. يمكنك اختيار موعد آخر هنا: ${window.location.origin}/ar/meeting/\n\nفريق Xposure`
      : `Hello ${first},\n\nWe are sorry, we need to cancel our meeting on ${formatDateTime(m.start_at)}. Please pick another time here: ${window.location.origin}/meeting/\n\nThe Xposure team`;
  const message = m.status === 'cancelled' ? cancelText : text;
  const subject = m.status === 'cancelled' ? 'Your meeting with Xposure' : 'Your Zoom meeting with Xposure is confirmed';
  const mailto = `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const wa = m.phone ? `https://wa.me/${whatsappNumber(m.phone)}?text=${encodeURIComponent(message)}` : '';
  const past = Date.parse(m.end_at) < Date.now();
  const canNotify = m.status === 'cancelled' || (m.status === 'confirmed' && link);

  return (
    <article className="card detail">
      <div className="detail-head">
        <Link to="/meetings" className="icon-button detail-back" aria-label="Back to meetings">
          <ArrowLeft size={18} />
        </Link>
        <Avatar name={m.name} size={44} />
        <div className="detail-title">
          <h2>{m.name}</h2>
          <p className="muted">
            Requested {timeAgo(m.created_at)}
            {m.company ? ` · ${m.company}` : ''}
          </p>
        </div>
        <div className="detail-tags">
          <StatusPill status={m.status} />
        </div>
      </div>

      <div className="when">
        <CalendarClock size={22} aria-hidden="true" />
        <div>
          <strong>{formatDate(m.start_at)}</strong>
          <span>
            {formatTime(m.start_at)} – {formatTime(m.end_at)} · {timeZone().replace('_', ' ')} time
          </span>
        </div>
        <a className="btn btn-secondary btn-sm" href={`/api/admin/meetings/${m.id}/ics`} download>
          <CalendarPlus size={15} aria-hidden="true" />
          <span>Add to my calendar</span>
        </a>
      </div>

      <dl className="contact-grid">
        <div>
          <dt>
            <Mail size={14} aria-hidden="true" /> Email
          </dt>
          <dd>
            <a href={`mailto:${m.email}`}>{m.email}</a>
          </dd>
        </div>
        {m.phone && (
          <div>
            <dt>
              <Phone size={14} aria-hidden="true" /> Phone / WhatsApp
            </dt>
            <dd dir="ltr">{m.phone}</dd>
          </div>
        )}
        <div>
          <dt>Topic</dt>
          <dd>{TOPICS[m.topic] ?? m.topic}</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>{m.locale === 'ar' ? 'Arabic' : 'English'}</dd>
        </div>
      </dl>
      {m.message && (
        <div className="message-body" dir="auto">
          {m.message}
        </div>
      )}
      {m.campaign && (
        <div className="meta-line">
          <Badge tone="pink">Campaign: {m.campaign}</Badge>
        </div>
      )}

      {m.status !== 'cancelled' && m.status !== 'completed' && (
        <div className="step-box">
          <h3>
            <span className={cx('step-dot', link && 'is-done')}>{link ? <Check size={13} /> : 1}</span> Zoom link
          </h3>
          {zoom && !link && (
            <Button variant="primary" icon={<Video size={16} />} loading={busy === 'zoom'} onClick={createZoom}>
              Create Zoom meeting
            </Button>
          )}
          <div className="inline-form">
            <TextInput
              label={zoom ? 'Or paste a meeting link' : 'Meeting link'}
              placeholder="https://us02web.zoom.us/j/…"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              type="url"
              dir="ltr"
            />
            {link !== m.join_url && (
              <Button onClick={() => update({ joinUrl: link }, 'Link saved.')} loading={busy === 'joinUrl'}>
                Save link
              </Button>
            )}
            {m.join_url && (
              <>
                <Button variant="ghost" icon={<Copy size={16} />} onClick={() => copy(m.join_url, 'Link copied')} aria-label="Copy link" />
                <a className="btn btn-ghost" href={m.join_url} target="_blank" rel="noopener noreferrer" aria-label="Open Zoom link">
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </>
            )}
          </div>

          <h3>
            <span className={cx('step-dot', m.status === 'confirmed' && 'is-done')}>{m.status === 'confirmed' ? <Check size={13} /> : 2}</span> Confirm
          </h3>
          {m.status === 'pending' ? (
            <Button variant="primary" icon={<CalendarCheck2 size={16} />} disabled={!m.join_url} loading={busy === 'status'} onClick={() => update({ status: 'confirmed' }, 'Meeting confirmed. Now send the confirmation.')}>
              Confirm meeting
            </Button>
          ) : (
            <p className="muted small">Confirmed. The time is reserved.</p>
          )}
        </div>
      )}

      {canNotify && (
        <div className="step-box">
          <h3>
            <span className="step-dot">{m.status === 'cancelled' ? '!' : 3}</span> {m.status === 'cancelled' ? 'Let the client know' : 'Send the confirmation'}
          </h3>
          <pre className="preview-text" dir="auto">
            {message}
          </pre>
          <div className="button-row">
            {wa && (
              <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} aria-hidden="true" />
                <span>Send on WhatsApp</span>
              </a>
            )}
            <a className="btn btn-secondary" href={mailto}>
              <Mail size={16} aria-hidden="true" />
              <span>Send by email</span>
            </a>
            <Button variant="ghost" icon={<Copy size={16} />} onClick={() => copy(message, 'Message copied')}>
              Copy text
            </Button>
          </div>
        </div>
      )}

      <div className="detail-actions is-footer">
        {m.status === 'confirmed' && past && (
          <Button icon={<Check size={16} />} onClick={() => update({ status: 'completed' }, 'Marked as completed.')}>
            Mark as completed
          </Button>
        )}
        <span className="spacer" />
        {(m.status === 'pending' || m.status === 'confirmed') && (
          <Button variant="ghost" icon={<X size={16} />} onClick={cancel}>
            Cancel meeting
          </Button>
        )}
      </div>

      <div className="note-box">
        <TextArea label="Internal note" value={note ?? m.note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={4000} />
        <Button size="sm" disabled={note === null || note === m.note} loading={busy === 'note'} onClick={() => note !== null && update({ note }, 'Note saved.')}>
          Save note
        </Button>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ availability
const DAYS: [keyof BookingSettings['weekly'], string][] = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

export function Availability() {
  const { data, setData, error, loading, reload } = useApi<BookingResponse>('/booking-settings');
  const [draft, setDraft] = useState<BookingSettings | null>(null);
  const [blocked, setBlocked] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (data) setDraft(structuredClone(data.settings));
  }, [data]);

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading || !draft || !data) return <Skeleton lines={10} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const set = <K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) => setDraft({ ...draft, [key]: value });
  const setDay = (day: keyof BookingSettings['weekly'], ranges: [string, string][]) => set('weekly', { ...draft.weekly, [day]: ranges });

  async function save() {
    setSaving(true);
    try {
      setData({ ...(await api<BookingResponse>('/booking-settings', { method: 'PUT', body: draft })), zoom: data!.zoom });
      toast({ tone: 'success', text: 'Availability saved. The booking page uses it immediately.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page narrow">
      <PageHeader
        title="Meeting availability"
        subtitle="When clients can book a Zoom meeting on the website."
        back={
          <Link to="/meetings" className="back-link">
            <ArrowLeft size={15} aria-hidden="true" /> Meetings
          </Link>
        }
        actions={
          <a className="btn btn-secondary" href="/meeting/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            <span>Open booking page</span>
          </a>
        }
      />

      <Card title="Online booking">
        <Toggle checked={draft.enabled} onChange={(value) => set('enabled', value)} label="Accept meeting requests on the website" description="When off, the booking page asks visitors to contact you on WhatsApp instead." />
        <Toggle
          checked={draft.autoConfirm && data.zoom}
          onChange={(value) => set('autoConfirm', value)}
          disabled={!data.zoom}
          label="Confirm automatically with a Zoom link"
          description={data.zoom ? 'New bookings are confirmed at once and the visitor sees the Zoom link straight away.' : 'Available once Zoom is connected in Settings.'}
        />
      </Card>

      <Card title="Meeting length and notice">
        <div className="form-grid">
          <Select
            label="Meeting length"
            value={String(draft.durationMinutes)}
            onChange={(e) => set('durationMinutes', Number(e.target.value) as BookingSettings['durationMinutes'])}
            options={[15, 20, 30, 45, 60].map((n) => ({ value: String(n), label: `${n} minutes` }))}
          />
          <Select
            label="Break between meetings"
            value={String(draft.bufferMinutes)}
            onChange={(e) => set('bufferMinutes', Number(e.target.value))}
            options={[0, 5, 10, 15, 30, 45, 60].map((n) => ({ value: String(n), label: n ? `${n} minutes` : 'None' }))}
          />
          <Select
            label="Minimum notice"
            value={String(draft.minNoticeHours)}
            onChange={(e) => set('minNoticeHours', Number(e.target.value))}
            options={[1, 2, 4, 12, 24, 48, 72].map((n) => ({ value: String(n), label: n < 24 ? plural(n, 'hour') : plural(n / 24, 'day') }))}
            help="How far ahead a meeting must be booked."
          />
          <Select
            label="Booking window"
            value={String(draft.windowDays)}
            onChange={(e) => set('windowDays', Number(e.target.value))}
            options={[7, 14, 21, 30, 60, 90].map((n) => ({ value: String(n), label: `Next ${n} days` }))}
          />
        </div>
      </Card>

      <Card title="Weekly hours" actions={<span className="muted small">{timeZone().replace('_', ' ')} time</span>}>
        <div className="week">
          {DAYS.map(([day, label]) => {
            const ranges = draft.weekly[day];
            return (
              <div key={day} className="week-row">
                <Toggle checked={ranges.length > 0} onChange={(on) => setDay(day, on ? [['10:00', '17:00']] : [])} label={label} />
                <div className="week-ranges">
                  {ranges.length === 0 && <span className="muted small">Unavailable</span>}
                  {ranges.map(([from, to], i) => (
                    <div key={i} className="range">
                      <input className="input" type="time" aria-label={`${label} from`} value={from} onChange={(e) => setDay(day, ranges.map((r, k) => (k === i ? [e.target.value, r[1]] : r)))} />
                      <span aria-hidden="true">–</span>
                      <input className="input" type="time" aria-label={`${label} until`} value={to} onChange={(e) => setDay(day, ranges.map((r, k) => (k === i ? [r[0], e.target.value] : r)))} />
                      <button type="button" className="icon-button is-small" aria-label={`Remove ${label} hours`} onClick={() => setDay(day, ranges.filter((_, k) => k !== i))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {ranges.length > 0 && ranges.length < 4 && (
                    <button type="button" className="link-button" onClick={() => setDay(day, [...ranges, ['14:00', '17:00']])}>
                      <Plus size={14} aria-hidden="true" /> Add hours
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Days off">
        <p className="muted small">Holidays or busy days when nobody can book.</p>
        <div className="inline-form">
          <TextInput label="Date" type="date" value={blocked} onChange={(e) => setBlocked(e.target.value)} />
          <Button
            icon={<Plus size={16} />}
            disabled={!blocked || draft.blockedDates.includes(blocked)}
            onClick={() => {
              set('blockedDates', [...draft.blockedDates, blocked].sort());
              setBlocked('');
            }}
          >
            Add day off
          </Button>
        </div>
        {draft.blockedDates.length > 0 && (
          <ul className="chips">
            {draft.blockedDates.map((date) => (
              <li key={date} className="chip">
                {formatDate(`${date}T12:00:00Z`)}
                <button type="button" aria-label={`Remove ${date}`} onClick={() => set('blockedDates', draft.blockedDates.filter((d) => d !== date))}>
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Next available times">
        {data.preview.length ? (
          <ul className="preview-days">
            {data.preview.map((day) => (
              <li key={day.date}>
                <strong>{formatDate(`${day.date}T12:00:00Z`)}</strong>
                <span className="muted">
                  {day.slots.slice(0, 8).map(formatTime).join(' · ')}
                  {day.slots.length > 8 ? ` +${day.slots.length - 8} more` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No free times with these settings. Visitors will be asked to contact you on WhatsApp.</p>
        )}
        <p className="help">Updated when you save.</p>
      </Card>

      <div className={cx('save-bar', dirty && 'is-visible')} role="region" aria-label="Unsaved changes">
        <span>You have unsaved changes</span>
        <Button variant="ghost" onClick={() => setDraft(structuredClone(data.settings))}>
          Discard
        </Button>
        <Button variant="primary" loading={saving} onClick={save}>
          Save availability
        </Button>
      </div>
    </div>
  );
}

