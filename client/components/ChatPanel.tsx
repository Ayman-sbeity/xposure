import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { track, type ContactMethod } from '../analytics';
import { replyTo, replyToQuick, welcomeMessage, type BotReply, type ChatLink, type Quick } from '../chat/engine';
import { site, whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { prefersReducedMotion } from '../motion';
import { ArrowUpRight, Close, MessageCircle, Phone, RotateCcw, SendHorizontal } from './icons';
import '../chat.css';

type UserLine = { from: 'user'; text: string };
type Message = (BotReply | UserLine) & { id: number };
type Saved = { v: 1; messages: Message[]; misses: number };

// The conversation is kept in the visitor's own browser for this tab only (sessionStorage),
// so it survives moving between pages. It is never sent anywhere.
const KEY = 'xposure-chat';
const KEEP = 60;
const SMALL_SCREEN = '(max-width: 700px)';

function load(): Saved | null {
  try {
    const data = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null');
    return data?.v === 1 && Array.isArray(data.messages) && data.messages.length ? (data as Saved) : null;
  } catch {
    return null;
  }
}
function save(data: Saved | null): void {
  try {
    if (data) window.sessionStorage.setItem(KEY, JSON.stringify({ ...data, messages: data.messages.slice(-KEEP) }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the chat still works, it just starts over on the next page */
  }
}

const methods: Partial<Record<ChatLink['kind'], ContactMethod>> = { whatsapp: 'whatsapp', call: 'phone', email: 'email' };

function LinkButton({ link }: { link: ChatLink }) {
  const outside = link.kind === 'whatsapp' || link.kind === 'external';
  const method = methods[link.kind];
  return (
    <a
      className={`chat-link is-${link.kind}`}
      href={link.href}
      {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => method && track('contact_click', { method, location: 'chat' })}
    >
      {link.kind === 'whatsapp' && <MessageCircle size={17} />}
      {link.kind === 'call' && <Phone size={17} />}
      <span dir="auto">{link.label}</span>
      <ArrowUpRight size={16} />
    </a>
  );
}

type Props = { closing: boolean; onClose: () => void; onClosed: () => void };

export default function ChatPanel({ closing, onClose, onClosed }: Props) {
  const { t, locale } = useI18n();
  const c = t.chat;
  const fresh = (): Saved => ({ v: 1, messages: [{ ...welcomeMessage(locale), id: 1 }], misses: 0 });
  const [state, setState] = useState<Saved>(() => load() ?? fresh());
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [small] = useState(() => window.matchMedia(SMALL_SCREEN).matches);
  const ids = useRef(Math.max(0, ...state.messages.map((m) => m.id)) + 1);
  const timer = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstScroll = useRef(true);

  // Open: keyboard users land in the text box on large screens; on phones the dialog itself
  // is focused so the on-screen keyboard does not cover the conversation straight away.
  useEffect(() => {
    if (small) panelRef.current?.focus();
    else inputRef.current?.focus();
    document.documentElement.classList.add('chat-open');
    return () => {
      document.documentElement.classList.remove('chat-open');
      window.clearTimeout(timer.current);
    };
  }, [small]);

  useEffect(() => save(state), [state]);

  // Keep the newest message in view.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const smooth = !firstScroll.current && !prefersReducedMotion();
    firstScroll.current = false;
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [state.messages.length, typing]);

  function respond(asked: string, answer: (misses: number) => BotReply) {
    if (typing) return;
    const reply = answer(state.misses);
    setState((s) => ({ ...s, messages: [...s.messages, { from: 'user', text: asked, id: ids.current++ }] }));
    setTyping(true);
    // Only the topic is measured, never the words typed.
    track('chat_question', { topic: reply.topic, location: 'chat' });
    // A short, natural pause that grows a little with the length of the answer.
    const wait = prefersReducedMotion() ? 150 : Math.min(1100, 380 + reply.text.join(' ').length * 3);
    timer.current = window.setTimeout(() => {
      setState((s) => ({
        v: 1,
        messages: [...s.messages, { ...reply, id: ids.current++ }],
        misses: reply.topic === 'fallback' ? s.misses + 1 : 0,
      }));
      setTyping(false);
    }, wait);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const asked = draft.trim();
    if (!asked || typing) return;
    setDraft('');
    respond(asked, (misses) => replyTo(asked, locale, misses));
  }

  function choose(chip: Quick) {
    respond(chip.label, () => replyToQuick(chip, locale));
    if (!small) inputRef.current?.focus();
  }

  function restart() {
    window.clearTimeout(timer.current);
    setTyping(false);
    const next = fresh();
    ids.current = 2;
    firstScroll.current = true;
    setState(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    // On phones the chat covers the page, so Tab stays inside it.
    if (event.key !== 'Tab' || !small || !panelRef.current) return;
    const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function onAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (closing && event.target === event.currentTarget) onClosed();
  }

  const last = state.messages[state.messages.length - 1];
  const chips = !typing && last?.from === 'bot' ? last.quick : undefined;

  return (
    <div
      ref={panelRef}
      className={closing ? 'chat-panel is-closing' : 'chat-panel'}
      role="dialog"
      aria-modal={small}
      aria-labelledby="chat-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="chat-head">
        <span className="chat-avatar" aria-hidden="true">
          X
        </span>
        <div className="chat-head-text">
          <h2 id="chat-title">{c.title}</h2>
          <p>{c.status}</p>
        </div>
        <a
          className="chat-head-btn"
          href={whatsappLink(t.common.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.common.whatsappAria}
          onClick={() => track('contact_click', { method: 'whatsapp', location: 'chat_header' })}
        >
          <MessageCircle size={18} />
        </a>
        <a className="chat-head-btn" href={`tel:${site.phone}`} aria-label={t.plan.call} onClick={() => track('contact_click', { method: 'phone', location: 'chat_header' })}>
          <Phone size={17} />
        </a>
        <button type="button" className="chat-head-btn" aria-label={c.restart} onClick={restart}>
          <RotateCcw size={16} />
        </button>
        <button type="button" className="chat-head-btn" aria-label={c.close} onClick={onClose}>
          <Close size={19} />
        </button>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-log" role="log" aria-live="polite" aria-label={c.log}>
          {state.messages.map((m) =>
            m.from === 'user' ? (
              <div key={m.id} className="chat-msg is-user" dir="auto">
                <p>{m.text}</p>
              </div>
            ) : (
              <div key={m.id} className="chat-msg is-bot" lang={m.lang} dir={m.lang === 'ar' ? 'rtl' : 'ltr'}>
                {m.text.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {m.list && (
                  <ul>
                    {m.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                {m.links && (
                  <div className="chat-links">
                    {m.links.map((link) => (
                      <LinkButton key={link.href + link.label} link={link} />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
        {typing && (
          <div className="chat-msg is-bot chat-typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {chips && chips.length > 0 && (
          <div className="chat-chips" role="group" aria-label={c.suggestions} key={last.id}>
            {chips.map((chip, i) => (
              <button key={chip.label} type="button" className="chat-chip" style={{ '--i': i } as CSSProperties} onClick={() => choose(chip)}>
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <label className="visually-hidden" htmlFor="chat-input">
          {c.inputLabel}
        </label>
        <input
          ref={inputRef}
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={c.placeholder}
          maxLength={300}
          autoComplete="off"
          enterKeyHint="send"
          dir="auto"
        />
        <button type="submit" className="chat-send" aria-label={c.send} disabled={!draft.trim() || typing}>
          <SendHorizontal size={19} />
        </button>
      </form>
      <p className="chat-note">{c.note}</p>
    </div>
  );
}
