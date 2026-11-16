import { useEffect, useState } from 'react';
import { Archive, ArrowLeft, Briefcase, CalendarDays, Copy, Download, Inbox as InboxIcon, Mail, MailOpen, MessageCircle, Phone, RotateCcw, Search, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { api, ApiError, type Message, type MessageList, type MessageStatus, type MessageType } from '../api';
import { Link, navigate } from '../router';
import {
  Avatar,
  Badge,
  Button,
  cx,
  EmptyState,
  ErrorNote,
  formatDateTime,
  humanize,
  plural,
  Select,
  Skeleton,
  StatusPill,
  Tabs,
  TextArea,
  timeAgo,
  useApi,
  useConfirm,
  useCopy,
  useToast,
  whatsappNumber,
} from '../ui';

const TYPE_LABEL: Record<MessageType, string> = { enquiry: 'Enquiry', brief: 'Event brief', application: 'Job application' };
const TYPE_TONE: Record<MessageType, string> = { enquiry: 'blue', brief: 'pink', application: 'violet' };
type View = 'inbox' | 'new' | 'replied' | 'archived' | 'spam';

const DETAIL_LABELS: Record<string, string> = {
  occasion: 'Occasion',
  services: 'Services',
  date: 'Event date',
  location: 'Location',
  guests: 'Expected guests',
  duration: 'Duration',
  role: 'Role',
  city: 'City / area',
  languages: 'Languages',
};

export function Inbox({ id }: { id: number | null }) {
  const [view, setView] = useState<View>('inbox');
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ status: view, ...(type ? { type } : {}), ...(q ? { q } : {}), limit: '100' });
  const list = useApi<MessageList>(`/messages?${params}`);
  const counts = list.data?.counts ?? {};

  return (
    <div className={cx('page split-page', id !== null && 'has-detail')}>
      <header className="page-header">
        <div>
          <h1>Inbox</h1>
          <p className="page-subtitle">
            Enquiries, event briefs and job applications sent from the website.
            {counts.new ? ` ${plural(counts.new, 'unread message')}.` : ''}
          </p>
        </div>
        <div className="page-actions">
          <a className="btn btn-secondary" href="/api/admin/export/messages.csv" download>
            <Download size={16} aria-hidden="true" />
            <span>Export CSV</span>
          </a>
        </div>
      </header>

      <div className="toolbar">
        <Tabs<View>
          label="Message folders"
          value={view}
          onChange={setView}
          items={[
            { value: 'inbox', label: 'Inbox', count: counts.inbox },
            { value: 'new', label: 'Unread', count: counts.new },
            { value: 'replied', label: 'Replied' },
            { value: 'archived', label: 'Archived' },
            { value: 'spam', label: 'Spam' },
          ]}
        />
        <div className="toolbar-right">
          <div className="search">
            <Search size={16} aria-hidden="true" />
            <input className="input" type="search" placeholder="Search name, email, phone…" aria-label="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select
            aria-label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: '', label: 'All types' },
              { value: 'enquiry', label: 'Enquiries' },
              { value: 'brief', label: 'Event briefs' },
              { value: 'application', label: 'Job applications' },
            ]}
          />
        </div>
      </div>

      <div className="split">
        <section className="split-list card" aria-label="Messages">
          {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
          {list.loading && !list.data ? (
            <div className="card-body">
              <Skeleton lines={6} />
            </div>
          ) : list.data && list.data.items.length ? (
            <ul className="message-list">
              {list.data.items.map((message) => (
                <li key={message.id}>
                  <Link to={`/inbox/${message.id}`} className={cx('message-row', message.status === 'new' && 'is-unread', message.id === id && 'is-selected')} aria-current={message.id === id ? 'true' : undefined}>
                    <Avatar name={message.name} />
                    <span className="message-row-main">
                      <span className="message-row-top">
                        <strong>{message.name}</strong>
                        <time dateTime={message.created_at}>{timeAgo(message.created_at)}</time>
                      </span>
                      <span className="message-row-subject">
                        <Badge tone={TYPE_TONE[message.type]}>{TYPE_LABEL[message.type]}</Badge>
                        <span className="truncate">{message.subject.replace(/^[^—]+— /, '')}</span>
                      </span>
                      {message.preview && <span className="message-row-preview">{message.preview}</span>}
                    </span>
                    {message.status === 'new' && <span className="unread-dot" aria-label="Unread" />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<InboxIcon size={22} />}
              title={q ? 'No messages match your search' : view === 'inbox' ? 'Your inbox is empty' : 'Nothing here'}
              text={view === 'inbox' && !q ? 'Messages from the contact form, the event planner and the careers page will appear here.' : undefined}
            />
          )}
        </section>
        <section className="split-detail" aria-label="Message">
          {id ? (
            <MessageDetail key={id} id={id} onChange={list.reload} />
          ) : (
            <div className="card split-placeholder">
              <EmptyState icon={<MailOpen size={22} />} title="Select a message" text="Choose a message on the left to read it and reply." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MessageDetail({ id, onChange }: { id: number; onChange: () => void }) {
  const { data, setData, error, loading } = useApi<{ message: Message }>(`/messages/${id}`);
  const [note, setNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopy();

  // The list shows this message as read once it has been opened.
  useEffect(() => {
    if (data) onChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)]);

  if (error) return <ErrorNote message={error} />;
  if (loading || !data)
    return (
      <div className="card card-body">
        <Skeleton lines={8} />
      </div>
    );
  const m = data.message;
  const first = m.name.split(' ')[0];

  async function setStatus(status: MessageStatus, quiet = false) {
    const previous = m.status;
    try {
      const result = await api<{ message: Message }>(`/messages/${id}`, { method: 'PATCH', body: { status } });
      setData(result);
      onChange();
      if (!quiet)
        toast({
          tone: 'success',
          text: status === 'archived' ? 'Message archived.' : status === 'spam' ? 'Moved to spam.' : `Marked as ${status}.`,
          action: { label: 'Undo', run: () => void setStatus(previous, true) },
        });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not update the message.' });
    }
  }

  async function saveNote() {
    if (note === null || note === m.note) return;
    setSavingNote(true);
    try {
      setData(await api<{ message: Message }>(`/messages/${id}`, { method: 'PATCH', body: { note } }));
      toast({ tone: 'success', text: 'Note saved.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save the note.' });
    } finally {
      setSavingNote(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: 'Delete this message?', text: `The message from ${m.name} will be deleted permanently. This cannot be undone.`, confirm: 'Delete message', danger: true }))) return;
    try {
      await api(`/messages/${id}`, { method: 'DELETE' });
      toast({ tone: 'success', text: 'Message deleted.' });
      onChange();
      navigate('/inbox');
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not delete the message.' });
    }
  }

  const subject = encodeURIComponent(`Re: ${m.subject}`);
  const greetingEn = `Hello ${first},\n\nThank you for contacting Xposure.\n\n`;
  const greetingAr = `مرحباً ${first}،\n\nشكراً لتواصلك مع Xposure.\n\n`;
  const greeting = m.locale === 'ar' ? greetingAr : greetingEn;
  const mailto = m.email ? `mailto:${m.email}?subject=${subject}&body=${encodeURIComponent(greeting)}` : '';
  const wa = m.phone ? `https://wa.me/${whatsappNumber(m.phone)}?text=${encodeURIComponent(greeting.trim())}` : '';
  const replied = () => m.status !== 'replied' && void setStatus('replied');
  const details = Object.entries(m.details).filter(([, value]) => (Array.isArray(value) ? value.length : value));

  return (
    <article className="card detail">
      <div className="detail-head">
        <Link to="/inbox" className="icon-button detail-back" aria-label="Back to the inbox">
          <ArrowLeft size={18} />
        </Link>
        <Avatar name={m.name} size={44} />
        <div className="detail-title">
          <h2>{m.name}</h2>
          <p className="muted">
            {m.company && (
              <>
                <Briefcase size={14} aria-hidden="true" /> {m.company} ·{' '}
              </>
            )}
            {formatDateTime(m.created_at)}
          </p>
        </div>
        <div className="detail-tags">
          <Badge tone={TYPE_TONE[m.type]}>{TYPE_LABEL[m.type]}</Badge>
          <StatusPill status={m.status} />
        </div>
      </div>

      <div className="detail-actions">
        {mailto && (
          <a className="btn btn-primary" href={mailto} onClick={replied}>
            <Mail size={16} aria-hidden="true" />
            <span>Reply by email</span>
          </a>
        )}
        {wa && (
          <a className="btn btn-whatsapp" href={wa} target="_blank" rel="noopener noreferrer" onClick={replied}>
            <MessageCircle size={16} aria-hidden="true" />
            <span>WhatsApp</span>
          </a>
        )}
        {m.phone && (
          <a className="btn btn-secondary" href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={16} aria-hidden="true" />
            <span>Call</span>
          </a>
        )}
        <span className="spacer" />
        {m.status === 'archived' || m.status === 'spam' ? (
          <Button icon={<RotateCcw size={16} />} onClick={() => setStatus('read')}>
            Move to inbox
          </Button>
        ) : (
          <Button icon={<Archive size={16} />} onClick={() => setStatus('archived')}>
            Archive
          </Button>
        )}
        {m.status !== 'spam' && <Button variant="ghost" icon={<ShieldAlert size={16} />} onClick={() => setStatus('spam')} aria-label="Mark as spam" title="Mark as spam" />}
        <Button variant="ghost" icon={<Trash2 size={16} />} onClick={remove} aria-label="Delete" title="Delete" />
      </div>

      <dl className="contact-grid">
        {m.email && (
          <div>
            <dt>
              <Mail size={14} aria-hidden="true" /> Email
            </dt>
            <dd>
              <a href={`mailto:${m.email}`}>{m.email}</a>
              <button type="button" className="icon-button is-small" aria-label="Copy email" onClick={() => copy(m.email, 'Email copied')}>
                <Copy size={14} />
              </button>
            </dd>
          </div>
        )}
        {m.phone && (
          <div>
            <dt>
              <Phone size={14} aria-hidden="true" /> Phone / WhatsApp
            </dt>
            <dd dir="ltr">
              {m.phone}
              <button type="button" className="icon-button is-small" aria-label="Copy phone number" onClick={() => copy(m.phone, 'Number copied')}>
                <Copy size={14} />
              </button>
            </dd>
          </div>
        )}
        {m.service && (
          <div>
            <dt>
              <UserRound size={14} aria-hidden="true" /> {m.type === 'application' ? 'Role' : 'Service'}
            </dt>
            <dd>{m.service}</dd>
          </div>
        )}
        {details
          .filter(([key]) => key !== 'role' && key !== 'services')
          .map(([key, value]) => (
            <div key={key}>
              <dt>
                {key === 'date' && <CalendarDays size={14} aria-hidden="true" />} {DETAIL_LABELS[key] ?? humanize(key)}
              </dt>
              <dd>{Array.isArray(value) ? value.join(', ') : value}</dd>
            </div>
          ))}
      </dl>

      {m.body && (
        <div className="message-body" dir="auto">
          {m.body}
        </div>
      )}

      <div className="meta-line">
        Sent via {m.channel === 'whatsapp' ? 'WhatsApp (also saved here)' : m.channel === 'email' ? 'email draft (also saved here)' : 'the website form'}
        {m.page && ` · from ${m.page}`}
        {m.campaign && (
          <>
            {' · '}
            <Badge tone="pink">Campaign: {m.campaign}</Badge>
          </>
        )}
        {m.locale === 'ar' && ' · Arabic site'}
      </div>

      <div className="note-box">
        <TextArea
          label="Internal note"
          help="Only visible to the team, e.g. “Called on Monday, sending proposal”."
          value={note ?? m.note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={4000}
        />
        <Button size="sm" onClick={saveNote} loading={savingNote} disabled={note === null || note === m.note}>
          Save note
        </Button>
      </div>
    </article>
  );
}
