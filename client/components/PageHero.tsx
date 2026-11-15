import type { ReactNode } from 'react';
import type { AssetKey } from '../content/assets';
import type { Crumb } from '../seo';
import { Photo } from './Photo';
import { Breadcrumbs } from './Sections';

type PageHeroProps = {
  trail: Crumb[];
  eyebrow: string;
  title: string;
  accent: string;
  lede: string;
  image?: AssetKey;
  /** Put the italic accent on its own line (long accents such as project headlines). */
  accentOnNewLine?: boolean;
  children?: ReactNode;
};

/** Inner-page hero: breadcrumb, single h1, lede, actions and an optional photo. */
export function PageHero({ trail, eyebrow, title, accent, lede, image, accentOnNewLine = false, children }: PageHeroProps) {
  return (
    <section className={image ? 'page-hero has-image' : 'page-hero'}>
      <div className="page-hero-copy">
        <Breadcrumbs trail={trail} />
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          {accentOnNewLine ? <br /> : ' '}
          <span className={accentOnNewLine ? 'serif accent-line' : 'serif'}>{accent}</span>
        </h1>
        <p className="page-lede">{lede}</p>
        {children && <div className="hero-actions">{children}</div>}
      </div>
      {image && (
        <div className="page-hero-visual">
          <Photo name={image} priority />
        </div>
      )}
    </section>
  );
}
