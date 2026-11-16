import { CalendarClock, FileText, History, Image, Inbox, KeyRound, LogIn, ShieldAlert, Download } from 'lucide-react';
import type { ComponentType } from 'react';
import type { ActivityItem } from '../api';
import { EmptyState, ErrorNote, formatDateTime, PageHeader, Skeleton, timeAgo, useApi } from '../ui';

function iconFor(action: string): ComponentType<{ size?: number }> {
  if (action.startsWith('Failed')) return ShieldAlert;
  if (action.startsWith('Signed')) return LogIn;
  if (action.includes('password') || action.includes('Password')) return KeyRound;
  if (action.includes('content') || action.includes('version')) return FileText;
  if (action.includes('image')) return Image;
  if (action.includes('eeting') || action.includes('availability') || action.includes('Zoom')) return CalendarClock;
  if (action.includes('xport') || action.includes('backup')) return Download;
  return Inbox;
}

export function Activity() {
  const { data, error, loading, reload } = useApi<{ items: ActivityItem[] }>('/activity?limit=200');
  return (
    <div className="page narrow">
      <PageHeader title="Activity log" subtitle="Who changed what, and when. Failed sign-in attempts are recorded too." />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton lines={8} />
      ) : data?.items.length ? (
        <ol className="timeline card">
          {data.items.map((item) => {
            const Icon = iconFor(item.action);
            return (
              <li key={item.id} className={item.action.startsWith('Failed') ? 'is-warning' : undefined}>
                <span className="timeline-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div>
                  <p>
                    <strong>{item.admin ?? (item.action.startsWith('Failed') ? 'Someone' : 'System')}</strong> {item.action.charAt(0).toLowerCase() + item.action.slice(1)}
                    {item.target && <span className="muted"> · {item.target}</span>}
                  </p>
                  <time className="muted small" dateTime={item.at} title={formatDateTime(item.at)}>
                    {timeAgo(item.at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState icon={<History size={22} />} title="Nothing yet" />
      )}
    </div>
  );
}
