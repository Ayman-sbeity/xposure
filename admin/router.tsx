// A tiny router for the admin panel (everything lives under /admin).
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react';

export const BASE = '/admin';
const EVENT = 'xp-admin-navigate';

/** Current path inside the admin, e.g. "/inbox/12". */
export function currentPath(): string {
  const path = window.location.pathname.slice(BASE.length) || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const update = () => setPath(currentPath());
    window.addEventListener('popstate', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return path;
}

// Pages with unsaved changes register a guard that can stop navigation.
let guard: (() => boolean) | null = null;
export const setNavigationGuard = (fn: (() => boolean) | null) => (guard = fn);

export function navigate(to: string, { replace = false } = {}): void {
  if (guard && !guard()) return;
  const url = BASE + (to === '/' ? '/' : to);
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
}

/** <a> that navigates inside the admin without reloading (new-tab clicks still work). */
export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      {...props}
      href={BASE + (to === '/' ? '/' : to)}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
      }}
    />
  );
}

/** Match "/inbox/:id" against a path; returns the parameters or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
