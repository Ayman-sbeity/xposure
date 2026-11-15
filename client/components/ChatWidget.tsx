import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { track } from '../analytics';
import { useI18n } from '../i18n';
import { prefersReducedMotion } from '../motion';
import { Close, MessageSquareText } from './icons';

// The conversation window is a separate download, fetched the first time a visitor points
// at, focuses or opens the chat, so pages stay light for everyone else.
const loadPanel = () => import('./ChatPanel');
const ChatPanel = lazy(loadPanel);

const OPEN_EVENT = 'xposure:open-chat';
const TEASER_KEY = 'xposure-chat-teaser-seen';
const TEASER_DELAY_MS = 12000;

/** Lets other buttons (such as the phone action bar) open the assistant. */
export function openChat(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const remember = () => {
  try {
    window.sessionStorage.setItem(TEASER_KEY, '1');
  } catch {
    /* storage blocked: the teaser may show again, which is harmless */
  }
};
const remembered = () => {
  try {
    return window.sessionStorage.getItem(TEASER_KEY) === '1';
  } catch {
    return false;
  }
};

/** Floating "Ask us" button, a one-time greeting bubble, and the chat window. */
export function ChatWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const show = useCallback((from: string) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTeaser(false);
    remember();
    setClosing(false);
    setOpen(true);
    track('chat_open', { location: from });
  }, []);

  const hide = useCallback(() => {
    // Without motion there is no exit animation to wait for.
    if (prefersReducedMotion()) setOpen(false);
    else setClosing(true);
    opener.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onOpen = () => show('action_dock');
    window.addEventListener(OPEN_EVENT, onOpen);
    // A single, dismissible greeting per visit, after the visitor has had time to look around.
    const timer = remembered()
      ? 0
      : window.setTimeout(() => {
          setTeaser(true);
          void loadPanel();
        }, TEASER_DELAY_MS);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.clearTimeout(timer);
    };
  }, [show]);

  const prefetch = () => void loadPanel();

  return (
    <>
      <div className={open ? 'chat-launcher-wrap is-open' : 'chat-launcher-wrap'}>
        {teaser && !open && (
          <div className="chat-teaser">
            <button type="button" className="chat-teaser-text" onClick={() => show('teaser')}>
              {t.chat.teaser}
            </button>
            <button
              type="button"
              className="chat-teaser-close"
              aria-label={t.chat.teaserClose}
              onClick={() => {
                setTeaser(false);
                remember();
              }}
            >
              <Close size={14} />
            </button>
          </div>
        )}
        <button
          type="button"
          className="chat-launcher"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => (open ? hide() : show('launcher'))}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onTouchStart={prefetch}
        >
          {open ? <Close size={22} /> : <MessageSquareText size={22} />}
          {/* The visible words are part of the button's name (WCAG 2.5.3). */}
          <span className="chat-launcher-label">{open ? t.chat.close : t.chat.launcher}</span>
          {!open && <span className="visually-hidden"> ({t.chat.title})</span>}
        </button>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ChatPanel
            closing={closing}
            onClose={hide}
            onClosed={() => {
              setOpen(false);
              setClosing(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
