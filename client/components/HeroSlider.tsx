import { useState, type AnimationEvent, type CSSProperties } from 'react';
import { SLIDE_SECONDS, slides } from '../content/home';
import { useI18n } from '../i18n';
import { prefersReducedMotion, useReducedMotion } from '../motion';
import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from './icons';
import { Photo } from './Photo';

/**
 * Full-screen photo slider for the home page. Slides come from client/content/home.ts.
 * It advances on its own, pauses on hover / keyboard focus, has a pause button, and does
 * not auto-advance for visitors who ask their device to reduce motion.
 *
 * Timing is driven by the progress bar in the active dot: when its CSS animation ends the
 * next slide shows. Pausing the animation therefore pauses the slider at exactly the same
 * point, and the bar always tells the truth about how long is left.
 */
export function HeroSlider() {
  const { t, href, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hold, setHold] = useState(false);
  const reduce = useReducedMotion();
  const total = slides.length;
  const go = (next: number) => setIndex((next + total) % total);
  const autoplay = playing && !hold && !reduce && total > 1;

  function onProgressEnd(event: AnimationEvent<HTMLSpanElement>) {
    // Re-check the media query: the end event can arrive before useReducedMotion has updated.
    if (event.animationName !== 'slide-progress' || !autoplay || prefersReducedMotion()) return;
    go(index + 1);
  }

  const fill = (text: string, n: number) => text.replace('{n}', String(n)).replace('{total}', String(total));

  return (
    <section
      className={autoplay ? 'slider' : 'slider is-paused'}
      style={{ '--slide-ms': `${SLIDE_SECONDS * 1000}ms` } as CSSProperties}
      aria-roledescription="carousel"
      aria-label={t.slider.label}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={() => setHold(false)}
    >
      <h1 className="slider-kicker">{t.hero.kicker}</h1>
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.image}
            className={active ? 'slide active' : 'slide'}
            role="group"
            aria-roledescription="slide"
            aria-label={fill(t.slider.slideOf, i + 1)}
            aria-hidden={!active}
          >
            <Photo name={slide.image} priority={i === 0} />
            <div className="slide-copy">
              <span className="slide-label">{slide.label[locale]}</span>
              <p className="slide-caption">{slide.caption[locale]}</p>
              <a className="button light" href={href(slide.link)} tabIndex={active ? 0 : -1}>
                {slide.button[locale]} <ArrowUpRight size={18} />
              </a>
            </div>
          </div>
        );
      })}
      {total > 1 && (
        <div className="slider-controls">
          <button type="button" aria-label={playing ? t.slider.pause : t.slider.play} onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" aria-label={t.slider.previous} onClick={() => go(index - 1)}>
            <ChevronLeft size={22} />
          </button>
          <div className="slider-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.image}
                type="button"
                className={i === index ? 'active' : ''}
                aria-label={fill(t.slider.goTo, i + 1)}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
              >
                <span className="dot" aria-hidden="true">
                  {i === index && <span className="dot-fill" onAnimationEnd={onProgressEnd} />}
                </span>
              </button>
            ))}
          </div>
          <button type="button" aria-label={t.slider.next} onClick={() => go(index + 1)}>
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </section>
  );
}
