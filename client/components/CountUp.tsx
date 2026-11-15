import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../motion';

const format = (n: number) => n.toLocaleString('en-US');

/**
 * A number that counts up when it scrolls into view.
 * - The real figure is in the prerendered HTML (search engines, no-JS and screen readers get it).
 * - Screen readers always read the final value; the animated digits are aria-hidden.
 * - If the number is already on screen at load, or motion is reduced, it simply stays put.
 */
export function CountUp({ value, prefix = '', suffix = '', duration = 1600 }: { value: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !('IntersectionObserver' in window)) return;
    let frame = 0;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false;
          // Visible on load: leave the final value. Off screen: reset to 0 (unseen) and wait.
          if (entry.isIntersecting) return observer.disconnect();
          setShown(0);
          return;
        }
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3)))); // ease-out cubic
          if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  const final = `${prefix}${format(value)}${suffix}`;
  return (
    <span ref={ref} className="count-up" dir="ltr">
      <span aria-hidden="true">
        {prefix}
        {format(shown)}
        {suffix}
      </span>
      <span className="visually-hidden">{final}</span>
    </span>
  );
}

/** '200+' -> { value: 200, suffix: '+' }; anything else returns null and is shown as written. */
export function parseFigure(text: string): { value: number; prefix: string; suffix: string } | null {
  const match = /^([^\d]*)(\d[\d,]*)(.*)$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[2].replace(/,/g, ''));
  return Number.isFinite(value) ? { prefix: match[1], value, suffix: match[3] } : null;
}
