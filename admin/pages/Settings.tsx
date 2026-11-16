import { useState, type FormEvent } from 'react';
import { CheckCircle2, Copy, Database, Download, KeyRound, Link2, UserRound, Video, XCircle } from 'lucide-react';
import { api, ApiError, type Admin, type Me } from '../api';
import { Link } from '../router';
import { Badge, Button, Card, PageHeader, TextInput, useCopy, useToast } from '../ui';

function strength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return { score: Math.min(score, 4), label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(score, 4)] };
}

export function Settings({ me, onUpdate }: { me: Me; onUpdate: (me: Me) => void }) {
  const toast = useToast();
  const copy = useCopy();
  const [name, setName] = useState(me.admin.name);
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [zoomResult, setZoomResult] = useState<string | null>(null);
  const origin = window.location.origin;
  const meter = strength(next);

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setSavingName(true);
    try {
      const result = await api<{ admin: Admin }>('/account', { method: 'PATCH', body: { name } });
      onUpdate({ ...me, admin: result.admin });
      toast({ tone: 'success', text: 'Name saved.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save.' });
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (next !== repeat) return toast({ tone: 'error', text: 'The new passwords do not match.' });
    setSavingPassword(true);
    try {
      await api('/account/password', { method: 'POST', body: { current, next } });
      setCurrent('');
      setNext('');
      setRepeat('');
      toast({ tone: 'success', text: 'Password changed. Other devices were signed out.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not change the password.' });
    } finally {
      setSavingPassword(false);
    }
  }

  async function testZoom() {
    setTesting(true);
    setZoomResult(null);
    try {
      await api('/integrations/zoom/test', { method: 'POST' });
      setZoomResult('ok');
    } catch (err) {
      setZoomResult(err instanceof ApiError ? err.message : 'Zoom did not respond.');
    } finally {
      setTesting(false);
    }
  }

  const links = [
    { label: 'Plan your event (4-step brief)', path: '/plan/' },
    { label: 'Book a Zoom meeting', path: '/meeting/' },
    { label: 'Contact page', path: '/contact/' },
    { label: 'Arabic home page', path: '/ar/' },
  ];

  return (
    <div className="page narrow">
      <PageHeader title="Settings" subtitle="Your account, Zoom, links to share and backups." />

      <Card title={<span className="card-title-icon"><UserRound size={18} aria-hidden="true" /> Your account</span>}>
        <form className="form-grid" onSubmit={saveName}>
          <TextInput label="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
          <TextInput label="Email" value={me.admin.email} disabled help="Used to sign in." />
          <div className="form-actions">
            <Button type="submit" loading={savingName} disabled={name === me.admin.name || name.trim().length < 2}>
              Save name
            </Button>
          </div>
        </form>
      </Card>

      <Card title={<span className="card-title-icon"><KeyRound size={18} aria-hidden="true" /> Change password</span>}>
        <form className="form-grid" onSubmit={changePassword}>
          <TextInput label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <div />
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={10}
            help={
              next ? (
                <span className="strength">
                  <span className={`strength-bar is-${meter.score}`}>
                    <span />
                  </span>
                  {meter.label}
                </span>
              ) : (
                'At least 10 characters. A short sentence is easy to remember and hard to guess.'
              )
            }
          />
          <TextInput label="Repeat new password" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required error={repeat && repeat !== next ? 'The passwords do not match.' : undefined} />
          <div className="form-actions">
            <Button type="submit" variant="primary" loading={savingPassword} disabled={!current || next.length < 10 || next !== repeat}>
              Change password
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title={<span className="card-title-icon"><Video size={18} aria-hidden="true" /> Zoom</span>}
        actions={me.zoom ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}
      >
        {me.zoom ? (
          <>
            <p className="muted">Zoom meetings and links are created from the Meetings page in one click.</p>
            <div className="button-row">
              <Button onClick={testZoom} loading={testing}>
                Test connection
              </Button>
              {zoomResult === 'ok' && (
                <span className="result is-ok">
                  <CheckCircle2 size={16} aria-hidden="true" /> Zoom is working.
                </span>
              )}
              {zoomResult && zoomResult !== 'ok' && (
                <span className="result is-error">
                  <XCircle size={16} aria-hidden="true" /> {zoomResult}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="muted">Without Zoom connected, paste a meeting link when you confirm a request. To create links automatically:</p>
            <ol className="steps-list">
              <li>
                Sign in at <a href="https://marketplace.zoom.us/" target="_blank" rel="noopener noreferrer">marketplace.zoom.us</a> with the company Zoom account and choose <strong>Develop › Build App › Server-to-Server OAuth</strong>.
              </li>
              <li>
                Under <strong>Scopes</strong>, add <code>meeting:write:meeting:admin</code> and <code>meeting:delete:meeting:admin</code>, then activate the app.
              </li>
              <li>
                Give the server these values (in its <code>.env</code> file): <code>ZOOM_ACCOUNT_ID</code>, <code>ZOOM_CLIENT_ID</code>, <code>ZOOM_CLIENT_SECRET</code>, and <code>ZOOM_USER_ID</code> (the email of the Zoom user who hosts the meetings). Then restart it.
              </li>
            </ol>
          </>
        )}
      </Card>

      <Card title={<span className="card-title-icon"><Link2 size={18} aria-hidden="true" /> Links to share</span>}>
        <p className="muted small">
          Add <code>?utm_source=instagram</code> (or facebook, whatsapp…) to see on the dashboard where each lead came from.
        </p>
        <ul className="share-links">
          {links.map((link) => (
            <li key={link.path}>
              <span>
                <strong>{link.label}</strong>
                <code>
                  {origin}
                  {link.path}
                </code>
              </span>
              <Button size="sm" variant="ghost" icon={<Copy size={15} />} onClick={() => copy(`${origin}${link.path}`, 'Link copied')}>
                Copy
              </Button>
            </li>
          ))}
        </ul>
        <p className="help">
          Meeting hours are set in <Link to="/meetings/availability">Meetings › Availability</Link>.
        </p>
      </Card>

      <Card title={<span className="card-title-icon"><Database size={18} aria-hidden="true" /> Your data</span>}>
        <p className="muted">Download everything the admin panel holds: messages, meetings, content edits and settings.</p>
        <div className="button-row">
          <a className="btn btn-secondary" href="/api/admin/export" download>
            <Download size={16} aria-hidden="true" />
            <span>Download backup (JSON)</span>
          </a>
          <a className="btn btn-secondary" href="/api/admin/export/messages.csv" download>
            <Download size={16} aria-hidden="true" />
            <span>Messages for Excel (CSV)</span>
          </a>
        </div>
      </Card>
    </div>
  );
}
