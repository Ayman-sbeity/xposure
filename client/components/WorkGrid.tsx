import { useState, type ReactNode } from 'react';
import { getWorkCards, type WorkCard, type WorkType } from '../content/projects';
import { useI18n } from '../i18n';
import { ArrowUpRight } from './icons';
import { Photo } from './Photo';
import { staggerIndex } from './Sections';

const filters = ['all', 'Events', 'Exhibitions', 'People'] as const;
type Filter = (typeof filters)[number];

function ProjectCard({ card, index }: { card: WorkCard; index: number }) {
  const { t, href } = useI18n();
  const typeLabel: Record<WorkType, string> = t.work.filters;
  return (
    <a className={`project project-${index}`} href={href(card.path)} style={staggerIndex(index)}>
      <div className="project-image">
        <Photo name={card.image} />
        <span className="round-arrow">
          <ArrowUpRight size={26} />
        </span>
        <span className="project-type">{typeLabel[card.type]}</span>
      </div>
      <div className="project-caption">
        <div>
          <span>
            {card.client}
            {card.year && !card.client.includes(card.year) && ` / ${card.year}`}
          </span>
          <h3>{card.title}</h3>
        </div>
        <ArrowUpRight size={21} />
      </div>
    </a>
  );
}

/** Filterable portfolio grid. Heading content is passed in so each page owns its h1/h2. */
export function WorkGrid({ heading }: { heading: ReactNode }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<Filter>('all');
  const [filtered, setFiltered] = useState(false);
  const visible = getWorkCards(locale, t).filter((card) => filter === 'all' || card.type === filter);
  const choose = (value: Filter) => {
    setFilter(value);
    setFiltered(true);
  };
  return (
    <>
      <div className="work-heading reveal">
        {heading}
        <div className="filters" role="group" aria-label={t.work.filterLabel}>
          {filters.map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => choose(value)}>
              {t.work.filters[value]}
            </button>
          ))}
        </div>
      </div>
      {/* First view: cards stagger in on scroll. After a filter click the grid is re-keyed so
          the matching cards animate in again. */}
      <div className={filtered ? 'projects is-filtering' : 'projects stagger'} key={filter}>
        {visible.map((card, i) => (
          <ProjectCard key={card.path} card={card} index={i} />
        ))}
      </div>
      <p className="visually-hidden" role="status">
        {filtered ? t.work.shown.replace('{n}', String(visible.length)) : ''}
      </p>
      <p className="work-note">{t.work.note}</p>
    </>
  );
}
