import { ArrowRight, BadgeCheck, BookOpen, Briefcase, Building2, HelpCircle, Images, LayoutPanelTop, Quote, Search, Type } from 'lucide-react';
import type { ComponentType } from 'react';
import type { SectionSummary } from '../api';
import { Link } from '../router';
import { Badge, ErrorNote, PageHeader, Skeleton, timeAgo, useApi } from '../ui';

const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  business: Building2,
  home: LayoutPanelTop,
  services: BadgeCheck,
  projects: Briefcase,
  faqs: HelpCircle,
  stats: Images,
  trust: Quote,
  seo: Search,
  text: Type,
  guides: BookOpen,
};

export function ContentList() {
  const { data, error, loading, reload } = useApi<{ sections: SectionSummary[] }>('/content');
  return (
    <div className="page">
      <PageHeader
        title="Website content"
        subtitle="Edit any part of the website in English and Arabic. Changes go live as soon as you publish, and every earlier version is kept."
      />
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <div className="section-grid">
          {data?.sections.map((section) => {
            const Icon = ICONS[section.id] ?? Type;
            return (
              <Link key={section.id} to={`/content/${section.id}`} className="card section-card">
                <span className="section-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="section-card-main">
                  <span className="section-card-title">
                    <strong>{section.title}</strong>
                    {section.customized ? <Badge tone="pink">Edited</Badge> : <Badge>Original</Badge>}
                  </span>
                  <span className="muted">{section.description}</span>
                  {section.updatedAt && (
                    <span className="small muted">
                      Last published {timeAgo(section.updatedAt)}
                      {section.updatedBy ? ` by ${section.updatedBy}` : ''}
                    </span>
                  )}
                </span>
                <ArrowRight size={18} className="section-card-arrow" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
