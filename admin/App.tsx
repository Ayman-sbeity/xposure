import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  ExternalLink,
  FileText,
  History,
  Images,
  Inbox as InboxIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Sun,
  X,
} from 'lucide-react';
import { api, whenSignedOut, type Me, type Stats } from './api';
import { Activity } from './pages/Activity';
import { ContentEditor } from './pages/ContentEditor';
import { ContentList } from './pages/ContentList';
import { Dashboard } from './pages/Dashboard';
import { Inbox } from './pages/Inbox';
import { Login } from './pages/Login';
import { MediaLibrary } from './pages/Media';
import { Availability, Meetings } from './pages/Meetings';
import { Settings } from './pages/Settings';
import { Link, match, navigate, usePath } from './router';
import { Avatar, ConfirmProvider, cx, setTimeZone, Skeleton, ToastProvider } from './ui';

type Theme = 'light' | 'dark';
const THEME_KEY = 'xp-admin-theme';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* storage blocked */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () =>
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage blocked: the choice lasts for this visit */
      }
      return next;
    });
  return [theme, toggle];
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inbox', label: 'Inbox', icon: InboxIcon, badge: 'messages' as const },
  { to: '/meetings', label: 'Meetings', icon: CalendarClock, badge: 'meetings' as const },
  { to: '/content', label: 'Website content', icon: FileText },
  { to: '/media', label: 'Media library', icon: Images },
  { to: '/activity', label: 'Activity log', icon: History },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const load = useCallback(() => {
    api<Me>('/me')
      .then((value) => {
        setTimeZone(value.timezone);
        setMe(value);
      })
      .catch(() => setMe(null));
  }, []);
  useEffect(() => {
    whenSignedOut(() => setMe(null));
    load();
  }, [load]);

  if (me === undefined) return <div className="boot" aria-label="Loading" />;
  return (
    <ToastProvider>
      <ConfirmProvider>{me ? <Shell me={me} onSignOut={() => setMe(null)} onUpdate={setMe} /> : <Login onSignedIn={load} />}</ConfirmProvider>
    </ToastProvider>
  );
}

function Shell({ me, onSignOut, onUpdate }: { me: Me; onSignOut: () => void; onUpdate: (me: Me) => void }) {
  const path = usePath();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({ messages: 0, meetings: 0 });

  // Sidebar badges, refreshed every minute and after each navigation.
  useEffect(() => {
    const refresh = () =>
      api<Stats>('/stats')
        .then((s) => setCounts({ messages: s.newMessages, meetings: s.pendingMeetings }))
        .catch(() => {});
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [path]);
  useEffect(() => setMenuOpen(false), [path]);

  async function signOut() {
    await api('/logout', { method: 'POST' }).catch(() => {});
    onSignOut();
  }

  let page: ReactNode;
  let params: Record<string, string> | null;
  if (path === '/') page = <Dashboard me={me} />;
  else if ((params = match('/inbox', path) ?? match('/inbox/:id', path))) page = <Inbox id={params.id ? Number(params.id) : null} />;
  else if (match('/meetings/availability', path)) page = <Availability />;
  else if ((params = match('/meetings', path) ?? match('/meetings/:id', path))) page = <Meetings id={params.id ? Number(params.id) : null} zoom={me.zoom} />;
  else if (match('/content', path)) page = <ContentList />;
  else if ((params = match('/content/:section', path))) page = <ContentEditor key={params.section} section={params.section} />;
  else if (match('/media', path)) page = <MediaLibrary />;
  else if (match('/activity', path)) page = <Activity />;
  else if (match('/settings', path)) page = <Settings me={me} onUpdate={onUpdate} />;
  else
    page = (
      <div className="card card-body">
        <h1>Page not found</h1>
        <p className="muted">
          <Link to="/">Back to the dashboard</Link>
        </p>
      </div>
    );

  const active = (to: string) => (to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`));

  return (
    <div className={cx('shell', menuOpen && 'menu-open')}>
      <a className="skip-link" href="#admin-main">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="brand">
          <img src="/assets/xposure-original-logo.png" alt="Xposure" width={120} height={29} />
          <span>Admin</span>
          <button type="button" className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="nav">
          {NAV.map((item) => {
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <Link key={item.to} to={item.to} className={cx('nav-item', active(item.to) && 'is-active')} aria-current={active(item.to) ? 'page' : undefined}>
                <item.icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {count > 0 && (
                  <span className="nav-badge" aria-label={`${count} new`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <a className="nav-item" href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} aria-hidden="true" />
            <span>View website</span>
          </a>
          <div className="user">
            <Avatar name={me.admin.name} size={34} />
            <div>
              <strong>{me.admin.name}</strong>
              <span>{me.admin.email}</span>
            </div>
          </div>
          <div className="sidebar-actions">
            <button type="button" className="icon-button" aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title="Light / dark" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <div className="backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className="main-column">
        <div className="topbar">
          <button type="button" className="icon-button" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu size={20} />
          </button>
          <img src="/assets/xposure-original-logo.png" alt="Xposure admin" width={104} height={25} />
          <button type="button" className="icon-button" aria-label="Go to the inbox" onClick={() => navigate('/inbox')}>
            <InboxIcon size={19} />
            {counts.messages > 0 && <span className="dot" />}
          </button>
        </div>
        <main id="admin-main" className="main" tabIndex={-1}>
          {page ?? <Skeleton />}
        </main>
      </div>
    </div>
  );
}
