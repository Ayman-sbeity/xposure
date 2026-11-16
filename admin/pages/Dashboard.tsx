import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, ExternalLink, FileText, Inbox, MailOpen, Sparkles, TrendingUp, Video } from 'lucide-react';
import type { Me, Stats } from '../api';
import { Link } from '../router';
import { Avatar, Button, Card, EmptyState, ErrorNote, formatShortDate, formatTime, humanize, plural, Skeleton, StatusPill, timeAgo, useApi } from '../ui';

const SERIES = [
  { key: 'enquiry', label: 'Enquiries' },
  { key: 'brief', label: 'Event briefs' },
  { key: 'meeting', label: 'Meeting requests' },
  { key: 'application', label: 'Job applications' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Beirut' }).format(new Date()));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard({ me }: { me: Me }) {
  const { data, error, loading, reload } = useApi<Stats>('/stats');
  const first = me.admin.name.split(' ')[0];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {greeting()}, {first}
          </h1>
          <p className="page-subtitle">Here is what your website brought in.</p>
        </div>
        <div className="page-actions">
          <a className="btn btn-secondary" href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            <span>View website</span>
          </a>
          <Link className="btn btn-primary" to="/content">
            <FileText size={16} aria-hidden="true" />
            <span>Edit content</span>
          </Link>
        </div>
      </header>

      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card card-body">
              <Skeleton lines={2} />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="kpis">
            <Kpi to="/inbox" icon={<Inbox size={20} />} tone="blue" label="New messages" value={data.newMessages} note="Unread in the inbox" />
            <Kpi to="/meetings" icon={<CalendarClock size={20} />} tone="amber" label="Meeting requests" value={data.pendingMeetings} note="Waiting for your confirmation" />
            <Kpi to="/meetings" icon={<Video size={20} />} tone="green" label="Confirmed meetings" value={data.upcomingMeetings} note="Coming up" />
            <LeadsKpi current={data.leadsThisMonth} previous={data.leadsLastMonth} />
          </div>

          <Card title="Leads in the last 30 days">
            <LeadsChart daily={data.daily} />
          </Card>

          <div className="grid-2">
            <Card
              title="Next meetings"
              actions={
                <Link className="link-more" to="/meetings">
                  All meetings <ArrowRight size={15} aria-hidden="true" />
                </Link>
              }
            >
              {data.nextMeetings.length ? (
                <ul className="list">
                  {data.nextMeetings.map((meeting) => (
                    <li key={meeting.id}>
                      <Link to={`/meetings/${meeting.id}`} className="list-row">
                        <span className="date-chip">
                          <strong>{formatShortDate(meeting.start_at).split(' ')[0]}</strong>
                          <span>{formatShortDate(meeting.start_at).split(' ')[1]}</span>
                        </span>
                        <span className="list-main">
                          <strong>{meeting.name}</strong>
                          <span className="muted">
                            {formatTime(meeting.start_at)}
                            {meeting.company ? ` · ${meeting.company}` : ''}
                          </span>
                        </span>
                        <StatusPill status={meeting.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<CalendarClock size={22} />} title="No meetings booked yet" text="Visitors book from the “Book a Zoom meeting” page." />
              )}
            </Card>

            <Card
              title="Latest messages"
              actions={
                <Link className="link-more" to="/inbox">
                  Open inbox <ArrowRight size={15} aria-hidden="true" />
                </Link>
              }
            >
              {data.recentMessages.length ? (
                <ul className="list">
                  {data.recentMessages.map((message) => (
                    <li key={message.id}>
                      <Link to={`/inbox/${message.id}`} className={`list-row${message.status === 'new' ? ' is-unread' : ''}`}>
                        <Avatar name={message.name} size={34} />
                        <span className="list-main">
                          <strong>{message.name}</strong>
                          <span className="muted truncate">{message.subject}</span>
                        </span>
                        <span className="list-meta">{timeAgo(message.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<MailOpen size={22} />} title="No messages yet" text="Enquiries, event briefs and applications from the website appear here." />
              )}
            </Card>
          </div>

          <div className="grid-2">
            <Card title="Where leads come from" actions={<span className="muted small">Last 90 days</span>}>
              <Ranking items={data.sources} empty="Add ?utm_source=instagram (or facebook, google…) to the links you share to see which channel brings each lead." />
            </Card>
            <Card title="Most requested services" actions={<span className="muted small">Last 90 days</span>}>
              <Ranking items={data.services} empty="Services chosen in enquiries and event briefs appear here." />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ to, icon, tone, label, value, note }: { to: string; icon: ReactNode; tone: string; label: string; value: number; note: string }) {
  return (
    <Link to={to} className="card kpi">
      <span className={`kpi-icon tone-${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value.toLocaleString('en')}</strong>
      <span className="kpi-note">{note}</span>
    </Link>
  );
}

function LeadsKpi({ current, previous }: { current: number; previous: number }) {
  const change = previous ? Math.round(((current - previous) / previous) * 100) : null;
  const up = change !== null && change >= 0;
  return (
    <div className="card kpi">
      <span className="kpi-icon tone-pink" aria-hidden="true">
        <TrendingUp size={20} />
      </span>
      <span className="kpi-label">Leads this month</span>
      <strong className="kpi-value">{current.toLocaleString('en')}</strong>
      <span className="kpi-note">
        {change === null ? (
          `${plural(previous, 'lead')} last month`
        ) : (
          <span className={up ? 'delta is-up' : 'delta is-down'}>
            {up ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
            {Math.abs(change)}% vs last month
          </span>
        )}
      </span>
    </div>
  );
}

function Ranking({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  if (!items.length) return <EmptyState icon={<Sparkles size={22} />} title="Nothing to show yet" text={empty} />;
  const max = Math.max(...items.map((item) => item.value));
  return (
    <ul className="ranking">
      {items.map((item) => (
        <li key={item.label}>
          <span className="ranking-label">{humanize(item.label)}</span>
          <span className="ranking-bar">
            <span style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
          <span className="ranking-value">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ chart
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A bar whose top (the data end) has 4px rounded corners and whose base is square. */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`;
}

function LeadsChart({ daily }: { daily: Stats['daily'] }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const totals = Object.fromEntries(SERIES.map((s) => [s.key, daily.reduce((sum, day) => sum + day[s.key], 0)])) as Record<SeriesKey, number>;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  if (!grand)
    return <EmptyState icon={<TrendingUp size={22} />} title="No leads in the last 30 days" text="Share your “Plan your event” link (/plan/) on Instagram and WhatsApp to start filling this chart." />;

  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 30 };
  const plotW = Math.max(width - pad.left - pad.right, 10);
  const plotH = height - pad.top - pad.bottom;
  const maxTotal = Math.max(...daily.map((d) => SERIES.reduce((sum, s) => sum + d[s.key], 0)), 1);
  const step = Math.max(1, Math.ceil(maxTotal / 4));
  const yMax = step * 4;
  const slot = plotW / daily.length;
  const barW = Math.max(Math.min(slot * 0.62, 22), 3);
  const y = (value: number) => pad.top + plotH - (value / yMax) * plotH;
  const hovered = hover !== null ? daily[hover] : null;

  return (
    <div className="chart">
      <div className="chart-top">
        <ul className="legend" aria-label="Legend">
          {SERIES.map((s, i) => (
            <li key={s.key}>
              <span className="swatch" style={{ background: `var(--series-${i + 1})` }} aria-hidden="true" />
              {s.label} <strong>{totals[s.key]}</strong>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? 'View as chart' : 'View as table'}
        </Button>
      </div>

      {table ? (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Leads per day, last 30 days</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                {SERIES.map((s) => (
                  <th key={s.key} scope="col" className="num">
                    {s.label}
                  </th>
                ))}
                <th scope="col" className="num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((day) => (
                <tr key={day.date}>
                  <th scope="row">{formatShortDate(`${day.date}T12:00:00Z`)}</th>
                  {SERIES.map((s) => (
                    <td key={s.key} className="num">
                      {day[s.key] || '–'}
                    </td>
                  ))}
                  <td className="num">
                    <strong>{SERIES.reduce((sum, s) => sum + day[s.key], 0)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-plot" ref={wrapRef} onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label={`Bar chart of ${grand} leads over the last 30 days. Use “View as table” for the numbers.`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <g key={i}>
                  <line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(step * i)} y2={y(step * i)} />
                  <text className="axis-label" x={pad.left - 8} y={y(step * i)} dy="0.32em" textAnchor="end">
                    {step * i}
                  </text>
                </g>
              ))}
              {daily.map((day, index) => {
                const cx = pad.left + slot * index + slot / 2;
                let base = 0;
                const total = SERIES.reduce((sum, s) => sum + day[s.key], 0);
                const segments = SERIES.map((s, i) => ({ ...s, i, value: day[s.key] })).filter((s) => s.value > 0);
                return (
                  <g key={day.date} className={hover !== null && hover !== index ? 'is-dim' : undefined}>
                    {segments.map((s, k) => {
                      const top = y(base + s.value);
                      const bottom = y(base);
                      base += s.value;
                      const isTop = k === segments.length - 1;
                      // 2px of surface between stacked segments.
                      const h = Math.max(bottom - top - (k > 0 ? 2 : 0), 1);
                      return isTop ? (
                        <path key={s.key} d={topRounded(cx - barW / 2, top, barW, h, 4)} fill={`var(--series-${s.i + 1})`} />
                      ) : (
                        <rect key={s.key} x={cx - barW / 2} y={top} width={barW} height={h} fill={`var(--series-${s.i + 1})`} />
                      );
                    })}
                    {index % 5 === 4 || index === 0 ? (
                      <text className="axis-label" x={cx} y={height - 8} textAnchor="middle">
                        {formatShortDate(`${day.date}T12:00:00Z`)}
                      </text>
                    ) : null}
                    {/* Hit area larger than the bar, covering the whole day. */}
                    <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setHover(index)} aria-hidden="true">
                      <title>{`${day.date}: ${total}`}</title>
                    </rect>
                  </g>
                );
              })}
              <line className="baseline" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
            </svg>
          )}
          {hovered && hover !== null && (
            <div
              className="tooltip"
              style={{
                left: Math.min(Math.max(pad.left + slot * hover + slot / 2, 90), width - 90),
                top: 8,
              }}
            >
              <strong>{formatShortDate(`${hovered.date}T12:00:00Z`)}</strong>
              {SERIES.map((s, i) => (
                <span key={s.key} className="tooltip-row">
                  <span className="swatch" style={{ background: `var(--series-${i + 1})` }} aria-hidden="true" />
                  {s.label}
                  <b>{hovered[s.key]}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
