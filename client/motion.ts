// Small motion helpers shared by the site. All animation is CSS (client/motion.css);
// these hooks only add classes, so prerendered HTML is complete and readable without JS.
import { useEffect, useState } from 'react';

const REDUCE = '(prefers-reduced-motion: reduce)';

/** True when the visitor has asked their device to reduce motion. Safe to call during prerender. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCE).matches;
}

/**
 * Live reduced-motion preference. Always `false` on the server and the first client render,
 * so hydration matches; it updates right after.
 */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(REDUCE);
    const update = () => setReduce(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduce;
}

/**
 * Scroll-reveal for `.reveal` (the element fades up) and `.stagger` (its children fade up
 * one after another; set `--i` on each child). Content already on screen when the page
 * loads is left as it is, so nothing above the fold flickers or is delayed.
 */
export function useReveal(): void {
  useEffect(() => {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    const targets = Array.from(document.querySelectorAll('.reveal, .stagger'));
    const fold = window.innerHeight * 0.92;
    for (const el of targets) if (el.getBoundingClientRect().top < fold) el.classList.add('in');
    document.body.classList.add('motion-ready');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      },
      // Any part of the element 8% above the bottom edge: works for elements of every height.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    for (const el of targets) if (!el.classList.contains('in')) observer.observe(el);
    return () => observer.disconnect();
  }, []);
}

/**
 * Scroll position for the sticky header: `scrolled` once the page has moved,
 * `hidden` while the visitor scrolls down (it comes back as soon as they scroll up).
 * rAF-throttled, passive listener.
 */
export function useScrollState(threshold = 24): { scrolled: boolean; hidden: boolean } {
  const [state, setState] = useState({ scrolled: false, hidden: false });
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - last;
      setState((prev) => {
        // Ignore tiny movements (trackpad jitter) when deciding the direction.
        const hidden = Math.abs(delta) < 6 ? prev.hidden : delta > 0 && y > 420;
        const scrolled = y > threshold;
        return scrolled === prev.scrolled && hidden === prev.hidden ? prev : { scrolled, hidden };
      });
      if (Math.abs(delta) >= 6) last = y;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return state;
}
