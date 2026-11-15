import { Fragment } from 'react';

/**
 * Two bands of words that slide sideways as the page is scrolled (CSS scroll-driven
 * animation, no JavaScript). Because the movement follows the visitor's own scrolling it
 * never moves on its own, so there is nothing to pause (WCAG 2.2.2). Browsers without
 * scroll-driven animations show a still band. Decorative: the same words are listed in
 * the services section right below, so it is hidden from screen readers.
 */
export function Marquee({ rows }: { rows: string[][] }) {
  return (
    <div className="marquee" aria-hidden="true">
      {rows.map((items, r) => (
        <div key={r} className={r % 2 ? 'marquee-row is-reverse is-outline' : 'marquee-row'}>
          {/* Repeated so the band is always wider than the screen while it moves. */}
          {[0, 1, 2].map((copy) => (
            <Fragment key={copy}>
              {items.map((item) => (
                <span key={`${copy}-${item}`} className="marquee-item">
                  {item}
                  <span className="marquee-star">✳</span>
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
