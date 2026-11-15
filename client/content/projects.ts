import type { Locale, Localized } from '../i18n';
import type { Strings } from '../i18n/strings';
import { projectsAr } from './ar';
import type { AssetKey } from './assets';

// Adapted from the original portfolio posts (see `source`). Project descriptions
// need client approval before publication. Unverified figures (e.g. guest totals)
// from the original posts are intentionally omitted.
export type ProjectResult = { value: string; label: Localized<string>; approved: boolean };

export type Project = {
  slug: string;
  client: string;
  title: string;
  type: 'Events' | 'Exhibitions';
  year: string;
  date: string;
  cover: AssetKey;
  gallery: AssetKey[];
  summary: string;
  body: string[];
  delivered: string[];
  services: string[];
  /**
   * Measurable outcomes (guests welcomed, staff provided, leads collected...).
   * Only entries with `approved: true` are displayed. Add a figure only when the
   * client has confirmed it in writing; never estimate.
   */
  results: ProjectResult[];
  /** Event video hosted in /public (MP4). Shown with a poster and loaded only on play. */
  video: { src: string; poster: AssetKey; title: Localized<string> } | null;
  metaTitle: string;
  metaDescription: string;
  source: string;
};

export const projects: Project[] = [
  {
    slug: 'ezzeddine-plus-iftar-2024',
    client: 'Ezzeddine Plus annual Iftar',
    title: 'An evening, beautifully brought together.',
    type: 'Events',
    year: '2024',
    date: '2024-04-13',
    cover: 'hostesses',
    gallery: [],
    summary:
      'Xposure’s event coordination and hospitality team supported the Ezzeddine Plus annual Iftar. A gathering built around thoughtful details and a welcoming guest experience.',
    body: [
      'For the Ezzeddine Plus 2024 annual Iftar, Xposure coordinated an evening that brought Ezzeddine Plus and its subsidiaries together.',
      'Our hostesses welcomed guests on arrival and our team guided them throughout the evening, keeping the flow of the night relaxed and well organised.',
      'To make the evening more interactive, Xposure added a photo booth, guest interviews and a thank-you card game in which guests holding the winning numbers left with prizes.',
    ],
    delivered: [
      'Event coordination',
      'Guest welcome by Xposure hostesses',
      'Guest guidance throughout the evening',
      'An interactive photo booth',
      'Guest interviews',
      'A thank-you card prize game',
    ],
    services: ['event-coordination', 'hostesses-and-receptionists', 'photo-marketing'],
    results: [
      // From the original post ("over 200 employees"). Unverified: confirm with Ezzeddine Plus, then approve.
      { value: '200+', label: { en: 'guests welcomed', ar: 'ضيف تم استقبالهم' }, approved: false },
    ],
    video: null,
    metaTitle: 'Ezzeddine Plus Annual Iftar 2024 | Xposure Work',
    metaDescription:
      'How Xposure coordinated the Ezzeddine Plus 2024 annual Iftar, with hostesses welcoming guests, an interactive photo booth, guest interviews and a prize game.',
    source:
      'https://xposurelb.com/index.php/portfolios/ezzeddine-plus-iftar-an-evening-of-exquisite-elegance-organized-by-xposure/',
  },
  {
    slug: 'horeca-exhibition-2024',
    client: 'Horeca Exhibition 2024',
    title: 'A presence that stands out.',
    type: 'Exhibitions',
    year: '2024',
    date: '2024-04-25',
    cover: 'horecaStand',
    gallery: ['horeca', 'horecaTalk', 'horecaMeeting'],
    summary:
      'A look at Xposure’s participation at Horeca Exhibition 2024, featuring the team and the event experience.',
    body: [
      'Horeca is an annual gathering where hospitality, culinary and beverage professionals present their offerings, share knowledge and build partnerships.',
      'At Horeca Exhibition 2024, Xposure took its own stand, presenting our hosting and promotion services and engaging with visitors throughout the exhibition.',
      'The exhibition was also a chance to meet industry professionals, decision-makers and fellow exhibitors, and to exchange ideas about where hosting and guest experience are heading.',
    ],
    delivered: [
      'An Xposure stand presenting our hosting and promotion services',
      'A team engaging visitors throughout the exhibition',
      'Conversations with industry professionals and fellow exhibitors',
    ],
    services: ['hostesses-and-receptionists', 'promotion-and-sales'],
    results: [],
    video: null,
    metaTitle: 'Horeca Exhibition 2024 | Xposure Work',
    metaDescription:
      'Xposure at Horeca Exhibition 2024: a stand presenting our hosting and promotion services, with a team engaging visitors, exhibitors and industry professionals.',
    source: 'https://xposurelb.com/index.php/portfolios/xposures-success-at-horeca-exhibition-2024/',
  },
];

export function getProjects(locale: Locale): Project[] {
  return projects.map((project) => ({ ...project, ...(locale === 'ar' ? projectsAr[project.slug] : {}) }));
}

export type WorkType = 'Events' | 'Exhibitions' | 'People';

export type WorkCard = {
  /** English path; localize with `href()` when rendering. */
  path: string;
  client: string;
  title: string;
  type: WorkType;
  year: string;
  image: AssetKey;
};

export function getWorkCards(locale: Locale, t: Strings): WorkCard[] {
  return [
    ...getProjects(locale).map((p) => ({
      path: `/work/${p.slug}/`,
      client: p.client,
      title: p.title,
      type: p.type,
      year: p.year,
      image: p.cover,
    })),
    { path: '/about/', client: t.work.teamClient, title: t.work.teamTitle, type: 'People' as const, year: '', image: 'team' as const },
  ];
}

export const findProject = (slug: string): Project | undefined => projects.find((project) => project.slug === slug);
