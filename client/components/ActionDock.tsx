import { useEffect, useState } from 'react';
import { track } from '../analytics';
import { site, whatsappLink } from '../content/site';
import { useI18n } from '../i18n';
import { openChat } from './ChatWidget';
import { ArrowUpRight, MessageCircle, MessageSquareText, Phone } from './icons';

/**
 * Phone-only bottom bar: "Plan your event", the chat assistant, and one-tap call and WhatsApp.
 * It slides up once the visitor is past the first screen, and steps aside while a form
 * (any element with `data-hide-dock`) is on screen so it never covers the fields.
 * Hidden on wider screens by CSS; there the floating WhatsApp button stays.
 */
export function ActionDock({ planPath }: { planPath: string }) {
  const { t, href } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScreen = new Set<Element>();
    let past = false;
    let frame = 0;
    const render = () => setVisible(past && onScreen.size === 0);

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      render();
    });
    document.querySelectorAll('[data-hide-dock]').forEach((el) => observer.observe(el));

    const check = () => {
      frame = 0;
      past = window.scrollY > window.innerHeight * 0.6;
      render();
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={visible ? 'action-dock is-visible' : 'action-dock'}>
      <a className="dock-main" href={href(planPath)}>
        {t.plan.dockCta} <ArrowUpRight size={18} />
      </a>
      <button type="button" className="dock-icon" aria-label={t.chat.open} onClick={openChat}>
        <MessageSquareText size={20} />
      </button>
      <a
        className="dock-icon"
        href={`tel:${site.phone}`}
        aria-label={t.plan.call}
        onClick={() => track('contact_click', { method: 'phone', location: 'action_dock' })}
      >
        <Phone size={20} />
      </a>
      <a
        className="dock-icon dock-whatsapp"
        href={whatsappLink(t.common.whatsappMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.common.whatsappAria}
        onClick={() => track('contact_click', { method: 'whatsapp', location: 'action_dock' })}
      >
        <MessageCircle size={20} />
      </a>
    </div>
  );
}
