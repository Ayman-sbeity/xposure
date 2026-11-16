import { useState, type FormEvent } from 'react';
import { CalendarClock, Eye, EyeOff, FileText, Inbox, Lock } from 'lucide-react';
import { api, ApiError } from '../api';
import { Button, TextInput } from '../ui';

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/login', { method: 'POST', body: { email, password } });
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-brand" aria-hidden="true">
        <img src="/assets/xposure-original-logo.png" alt="" width={170} height={41} />
        <div>
          <h2>Everything your website brings in, in one place.</h2>
          <ul>
            <li>
              <Inbox size={18} /> Enquiries, event briefs and applications
            </li>
            <li>
              <CalendarClock size={18} /> Zoom meeting requests and availability
            </li>
            <li>
              <FileText size={18} /> Every page’s content, in English and Arabic
            </li>
          </ul>
        </div>
        <p>Xposure · Beirut, Lebanon</p>
      </section>
      <main className="login-panel">
        <form className="login-card" onSubmit={submit} noValidate>
          <span className="login-icon">
            <Lock size={20} aria-hidden="true" />
          </span>
          <h1>Sign in to Xposure Admin</h1>
          <p className="muted">Use the email and password of your admin account.</p>
          {error && (
            <div className="alert is-error" role="alert">
              {error}
            </div>
          )}
          <TextInput label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          <TextInput
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            extra={
              <button type="button" className="link-button" onClick={() => setShow(!show)} aria-pressed={show}>
                {show ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />} {show ? 'Hide' : 'Show'}
              </button>
            }
          />
          <Button type="submit" variant="primary" loading={busy} className="btn-block" disabled={!email || !password}>
            Sign in
          </Button>
          <details className="login-help">
            <summary>Forgot your password?</summary>
            <p>
              Ask the person who manages the website server to run <code>npm run admin -- password your@email.com NewPassword</code>. For security, passwords cannot be
              sent by email.
            </p>
          </details>
        </form>
      </main>
    </div>
  );
}
