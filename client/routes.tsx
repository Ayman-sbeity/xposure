import type { ReactElement } from 'react';
import type { Section } from './components/Header';
import { assetUrl } from './content/assets';
import { slides } from './content/home';
import { contentVersion } from './content/editable';
import { getFaqs } from './content/faqs';
import { guides } from './content/guides';
import { pageText } from './content/pages';
import { getProjects } from './content/projects';
import { getServices } from './content/services';
import { site } from './content/site';
import { localizePath, splitLocale, stringsFor, type Locale } from './i18n';
import { CareersPage } from './pages/CareersPage';
import { GuidePage, GuidesPage } from './pages/GuidePages';
import { HomePage } from './pages/HomePage';
import { AboutPage, ContactPage, NotFoundPage, PrivacyPage } from './pages/InfoPages';
import { MeetingPage } from './pages/MeetingPage';
import { PlanPage } from './pages/PlanPage';
import { ServicePage, ServicesPage } from './pages/ServicePages';
import { ProjectPage, WorkPage } from './pages/WorkPages';
import { absoluteUrl, organizationId, websiteSchema, type Crumb, type PageMeta } from './seo';

export type Route = { meta: PageMeta; section: Section; render: () => ReactElement };

/** Canonical form: leading and trailing slash, no index.html, no query or hash. */
export function normalizePath(raw: string): string {
  let path = raw.split(/[?#]/)[0].replace(/\/index\.html$/, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path.replace(/\/{2,}/g, '/');
}

// Rebuilt whenever the admin panel changes content (new service, renamed project, new titles).
let table = new Map<string, Route>();
let builtFor = -1;

type Text = { title: string; description: string };
type Def = {
  /** English path. */
  path: string;
  section: Section;
  text: Text;
  crumbs?: Crumb[];
  schema?: PageMeta['schema'];
  preloadImage?: string;
  render: () => ReactElement;
};

/** Registers a page. `bilingual` pages also exist under /ar/. */
function add(locale: Locale, bilingual: boolean, def: Def) {
  const t = stringsFor(locale);
  const path = localizePath(locale, def.path);
  table.set(path, {
    section: def.section,
    render: def.render,
    meta: {
      path,
      locale,
      title: def.text.title,
      description: def.text.description,
      alternates: bilingual ? { en: def.path, ar: localizePath('ar', def.path) } : { en: def.path },
      homeCrumb: { name: t.crumbs.home, path: localizePath(locale, '/') },
      breadcrumbs: def.crumbs?.map((crumb) => ({ name: crumb.name, path: localizePath(locale, crumb.path) })),
      schema: def.schema,
      preloadImage: def.preloadImage,
    },
  });
}


function build(): void {
  table = new Map<string, Route>();
  for (const locale of ['en', 'ar'] as const) {
    const t = stringsFor(locale);
    const services = getServices(locale);
    const projects = getProjects(locale);

    add(locale, true, {
      path: '/',
      section: 'home',
      text: pageText.home[locale],
      // The first slider photo is the largest thing on screen, so fetch it first.
      preloadImage: assetUrl(slides[0].image),
      schema: [
        websiteSchema,
        {
          '@type': 'FAQPage',
          inLanguage: locale,
          mainEntity: getFaqs(locale).map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        },
      ],
      render: () => <HomePage />,
    });

    add(locale, true, {
      path: '/about/',
      section: 'about',
      text: pageText.about[locale],
      crumbs: [{ name: t.crumbs.about, path: '/about/' }],
      preloadImage: assetUrl('team'),
      render: () => <AboutPage />,
    });

    add(locale, true, {
      path: '/services/',
      section: 'services',
      text: pageText.services[locale],
      crumbs: [{ name: t.crumbs.services, path: '/services/' }],
      render: () => <ServicesPage />,
    });

    for (const service of services) {
      const path = `/services/${service.slug}/`;
      add(locale, true, {
        path,
        section: 'services',
        text: { title: service.metaTitle, description: service.metaDescription },
        crumbs: [
          { name: t.crumbs.services, path: '/services/' },
          { name: service.name, path },
        ],
        preloadImage: assetUrl(service.image),
        schema: [
          {
            '@type': 'Service',
            name: service.name,
            serviceType: service.name,
            description: service.summary,
            inLanguage: locale,
            url: absoluteUrl(localizePath(locale, path)),
            image: absoluteUrl(assetUrl(service.image)),
            provider: { '@id': organizationId },
            areaServed: { '@type': 'Country', name: site.countryName },
          },
        ],
        render: () => <ServicePage slug={service.slug} />,
      });
    }

    add(locale, true, {
      path: '/work/',
      section: 'work',
      text: pageText.work[locale],
      crumbs: [{ name: t.crumbs.work, path: '/work/' }],
      render: () => <WorkPage />,
    });

    for (const project of projects) {
      const path = `/work/${project.slug}/`;
      add(locale, true, {
        path,
        section: 'work',
        text: { title: project.metaTitle, description: project.metaDescription },
        crumbs: [
          { name: t.crumbs.work, path: '/work/' },
          { name: project.client, path },
        ],
        preloadImage: assetUrl(project.cover),
        render: () => <ProjectPage slug={project.slug} />,
      });
    }

    add(locale, true, {
      path: '/contact/',
      section: 'contact',
      text: pageText.contact[locale],
      crumbs: [{ name: t.crumbs.contact, path: '/contact/' }],
      render: () => <ContactPage />,
    });

    add(locale, true, {
      path: '/plan/',
      section: 'plan',
      text: pageText.plan[locale],
      crumbs: [{ name: t.crumbs.plan, path: '/plan/' }],
      render: () => <PlanPage />,
    });

    add(locale, true, {
      path: '/meeting/',
      section: 'none',
      text: pageText.meeting[locale],
      crumbs: [{ name: t.crumbs.meeting, path: '/meeting/' }],
      render: () => <MeetingPage />,
    });

    add(locale, true, {
      path: '/careers/',
      section: 'none',
      text: pageText.careers[locale],
      crumbs: [{ name: t.crumbs.careers, path: '/careers/' }],
      render: () => <CareersPage />,
    });
  }

  // English-only pages.
  add('en', false, {
    path: '/guides/',
    section: 'none',
    text: {
      title: 'Event Planning Guides | Xposure',
      description:
        'Practical guides from Xposure on briefing an event staffing agency and staffing an exhibition stand, to help you plan events in Lebanon with confidence.',
    },
    crumbs: [{ name: 'Guides', path: '/guides/' }],
    render: () => <GuidesPage />,
  });

  for (const guide of guides) {
    const path = `/guides/${guide.slug}/`;
    add('en', false, {
      path,
      section: 'none',
      text: { title: guide.metaTitle, description: guide.description },
      crumbs: [
        { name: 'Guides', path: '/guides/' },
        { name: guide.title, path },
      ],
      schema: [
        {
          '@type': 'Article',
          headline: guide.title,
          description: guide.description,
          datePublished: guide.published,
          inLanguage: 'en',
          mainEntityOfPage: absoluteUrl(path),
          image: absoluteUrl(site.shareImage.src),
          author: { '@id': organizationId },
          publisher: { '@id': organizationId },
        },
      ],
      render: () => <GuidePage guide={guide} />,
    });
  }

  add('en', false, {
    path: '/privacy/',
    section: 'none',
    text: {
      title: 'Privacy Notice | Xposure',
      description:
        'How the Xposure website handles the details you send through its enquiry and application forms, and how analytics cookies are used only with consent.',
    },
    crumbs: [{ name: 'Privacy', path: '/privacy/' }],
    render: () => <PrivacyPage />,
  });
}

function routes(): Map<string, Route> {
  if (builtFor !== contentVersion()) {
    build();
    builtFor = contentVersion();
  }
  return table;
}

const notFound: Route = {
  section: 'none',
  meta: {
    path: '/404/',
    locale: 'en',
    title: 'Page not found | Xposure',
    description: 'The page you’re looking for doesn’t exist or has moved.',
    noindex: true,
  },
  render: () => <NotFoundPage />,
};

export function resolveRoute(rawPath: string): Route {
  const path = normalizePath(rawPath);
  const found = routes().get(path);
  if (found) return found;
  // Unknown Arabic URLs get the Arabic 404 text; everything else the English one.
  return splitLocale(path).locale === 'ar'
    ? { ...notFound, meta: { ...notFound.meta, locale: 'ar', title: 'الصفحة غير موجودة | Xposure' } }
    : notFound;
}

/** Every page, for prerendering and the sitemap. */
export function allRoutes(): Route[] {
  return [...routes().values()];
}
