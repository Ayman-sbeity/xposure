// Shared building blocks for the admin panel.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { api, ApiError } from './api';

// ------------------------------------------------------------------ formatting
let zone = 'Asia/Beirut';
export const setTimeZone = (tz: string) => (zone = tz);
export const timeZone = () => zone;

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options });
export const formatDateTime = (iso: string) => fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const formatDate = (iso: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
export const formatShortDate = (iso: string) => fmt({ day: 'numeric', month: 'short' }).format(new Date(iso));
export const formatTime = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(iso));

export function timeAgo(iso: string): string {
  const seconds = Math.round((Date.now() - Date.parse(iso)) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(-Math.round(seconds / size), unit);
  return 'just now';
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
export const humanize = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** wa.me needs digits with the country code; Lebanese local numbers get 961. */
export function whatsappNumber(phone: string): string {
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  digits = digits.replace(/^0/, '');
  return digits.length <= 8 ? `961${digits}` : digits;
}

// ------------------------------------------------------------------ data loading
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api<T>(path)
      .then((value) => alive && (setData(value), setError(null)))
      .catch((err: ApiError) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, setData, error, loading, reload };
}

// ------------------------------------------------------------------ toasts
type Toast = { id: number; tone: 'success' | 'error' | 'info'; text: string; action?: { label: string; run: () => void } };
const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));
  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-3), { ...toast, id }]);
    window.setTimeout(() => remove(id), toast.action ? 7000 : 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertTriangle : Info;
          return (
            <div key={toast.id} className={`toast is-${toast.tone}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{toast.text}</span>
              {toast.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    toast.action!.run();
                    remove(toast.id);
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button type="button" className="icon-button is-small" aria-label="Dismiss" onClick={() => remove(toast.id)}>
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ------------------------------------------------------------------ dialogs
/** A modal built on <dialog>: focus is trapped, Esc closes, the page behind is inert. */
export function Dialog({ open, onClose, title, children, footer, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={cx('dialog', wide && 'is-wide')}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
    >
      {open && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="dialog-content">{children}</div>
          {footer && <div className="dialog-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

type ConfirmOptions = { title: string; text: string; confirm: string; danger?: boolean };
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...options, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
              {state?.confirm}
            </Button>
          </>
        }
      >
        <p className="muted">{state?.text}</p>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

// ------------------------------------------------------------------ controls
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode };
export function Button({ variant = 'secondary', size = 'md', loading = false, icon, children, className, disabled, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={cx('icon-button', className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  new: 'blue',
  read: 'neutral',
  replied: 'green',
  archived: 'neutral',
  spam: 'red',
  pending: 'amber',
  confirmed: 'green',
  completed: 'neutral',
  cancelled: 'red',
};
export function StatusPill({ status }: { status: string }) {
  return <span className={`pill tone-${TONES[status] ?? 'neutral'}`}>{humanize(status)}</span>;
}
export function Badge({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

const AVATAR_HUES = [210, 330, 160, 30, 270, 0, 190];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const hue = AVATAR_HUES[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, ['--hue' as string]: hue }} aria-hidden="true">
      {initials || '?'}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (value: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" role="tab" aria-selected={item.value === value} className={cx('tab', item.value === value && 'is-active')} onClick={() => onChange(item.value)}>
          {item.label}
          {item.count !== undefined && item.count > 0 && <span className="tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cx('toggle-row', disabled && 'is-disabled')}>
      <button id={id} type="button" role="switch" aria-checked={checked} className={cx('switch', checked && 'is-on')} onClick={() => onChange(!checked)} disabled={disabled}>
        <span />
      </button>
      <label htmlFor={id}>
        <span className="toggle-label">{label}</span>
        {description && <span className="help">{description}</span>}
      </label>
    </div>
  );
}

type FieldShell = { label?: string; help?: ReactNode; error?: string; extra?: ReactNode };
export function Field({ label, help, error, extra, children, id }: FieldShell & { children: ReactNode; id: string }) {
  return (
    <div className={cx('field', error && 'has-error')}>
      {label && (
        <div className="field-label">
          <label htmlFor={id}>{label}</label>
          {extra}
        </div>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : help ? <p className="help">{help}</p> : null}
    </div>
  );
}
export function TextInput({ label, help, error, extra, ...props }: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field id={props.id ?? id} label={label} help={help} error={error} extra={extra}>
      <input id={props.id ?? id} className="input" aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}
export function TextArea({ label, help, error, extra, ...props }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text, so long paragraphs are fully visible while editing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 520)}px`;
  }, [props.value]);
  return (
    <Field id={props.id ?? id} label={label} help={help} error={error} extra={extra}>
      <textarea ref={ref} id={props.id ?? id} className="input textarea" aria-invalid={error ? true : undefined} {...props} />
    </Field>
  );
}
export function Select({ label, help, error, options, ...props }: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Field id={props.id ?? id} label={label} help={help} error={error}>
      <select id={props.id ?? id} className="input select" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ------------------------------------------------------------------ layout pieces
export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={padded ? 'card-body' : undefined}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert is-error" role="alert">
      <AlertTriangle size={18} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Copy text and say so. */
export function useCopy() {
  const toast = useToast();
  return async (text: string, what = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', text: `${what} to the clipboard.` });
    } catch {
      toast({ tone: 'error', text: 'Your browser blocked copying. Select the text and copy it instead.' });
    }
  };
}
