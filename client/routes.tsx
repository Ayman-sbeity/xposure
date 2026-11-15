import type { ReactElement } from 'react';
import type { Section } from './components/Header';
import { assetUrl } from './content/assets';
import { slides } from './content/home';
import { getFaqs } from './content/faqs';
import { guides } from './content/guides';
import { getProjects } from './content/projects';
import { getServices } from './content/services';
import { site } from './content/site';
import { localizePath, splitLocale, stringsFor, type Locale } from './i18n';
import { CareersPage } from './pages/CareersPage';
import { GuidePage, GuidesPage } from './pages/GuidePages';
import { HomePage } from './pages/HomePage';
import { AboutPage, ContactPage, NotFoundPage, PrivacyPage } from './pages/InfoPages';
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

const table = new Map<string, Route>();

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

const staticText: Record<'home' | 'about' | 'services' | 'work' | 'contact' | 'careers' | 'plan', Record<Locale, Text>> = {
  plan: {
    en: {
      title: 'Plan Your Event & Request a Proposal | Xposure',
      description:
        'Plan your event with Xposure in four quick steps: choose the occasion and services, add the details, and send your brief by WhatsApp or email.',
    },
    ar: {
      title: 'خطّط لفعاليتك واطلب عرضاً | Xposure',
      description:
        'خطّط لفعاليتك مع Xposure في أربع خطوات سريعة: اختر المناسبة والخدمات، أضف التفاصيل، ثم أرسل طلبك عبر واتساب أو البريد الإلكتروني.',
    },
  },
  home: {
    en: {
      title: 'Xposure | Hostess & Promoter Agency in Beirut, Lebanon',
      description:
        'Xposure is a Beirut-based hostess and promoter agency: hostesses, receptionists, event coordination, promoters and photo marketing for events in Lebanon.',
    },
    ar: {
      title: 'Xposure | وكالة مضيفات ومروّجين في بيروت، لبنان',
      description:
        'Xposure وكالة مضيفات ومروّجين مقرها بيروت: مضيفات، موظفو استقبال، تنسيق فعاليات، مروّجون وتسويق بالصور لفعاليات الشركات والمعارض في لبنان.',
    },
  },
  about: {
    en: {
      title: 'About Xposure | Hostess Company in Lebanon',
      description:
        'Meet Xposure, a Beirut-based hostess and promoter agency bringing professional talent and event coordination to corporate events, exhibitions and occasions.',
    },
    ar: {
      title: 'عن Xposure | وكالة مضيفات في لبنان',
      description:
        'تعرّف على Xposure، وكالة مضيفات ومروّجين مقرها بيروت توفّر فريقاً محترفاً وخدمات تنسيق الفعاليات للشركات والمعارض والمناسبات الخاصة في لبنان.',
    },
  },
  services: {
    en: {
      title: 'Event Staffing Services in Lebanon | Xposure',
      description:
        'Hostesses, receptionists, event coordination, promotion and sales teams, photo marketing and brand consulting from Xposure, a Beirut-based agency.',
    },
    ar: {
      title: 'خدمات فرق عمل الفعاليات في لبنان | Xposure',
      description:
        'مضيفات، موظفو استقبال، تنسيق فعاليات، فرق ترويج ومبيعات، تسويق بالصور واستشارات العلامة التجارية من Xposure، وكالة مقرها بيروت.',
    },
  },
  work: {
    en: {
      title: 'Selected Work: Events & Exhibitions | Xposure',
      description:
        'A selection of events and exhibitions Xposure has supported, including the Ezzeddine Plus annual Iftar and Horeca Exhibition 2024.',
    },
    ar: {
      title: 'أعمالنا: فعاليات ومعارض | Xposure',
      description:
        'مجموعة من الفعاليات والمعارض التي شاركت فيها Xposure، ومنها إفطار Ezzeddine Plus السنوي ومعرض هوريكا 2024 في لبنان، مع صور وتفاصيل كل مشروع.',
    },
  },
  contact: {
    en: {
      title: 'Contact Xposure | Book Hostesses & Event Staff in Beirut',
      description: `Tell Xposure about your event. Email ${site.email}, call or WhatsApp ${site.phoneDisplay}, or send your brief through the enquiry form.`,
    },
    ar: {
      title: 'تواصل مع Xposure | احجز مضيفات وفريق فعاليات في بيروت',
      description: `أخبر Xposure عن فعاليتك. راسلنا على ${site.email} أو اتصل أو راسلنا عبر واتساب على ${site.phoneDisplay}، أو أرسل تفاصيل طلبك عبر النموذج.`,
    },
  },
  careers: {
    en: {
      title: 'Careers: Hostess & Promoter Jobs in Lebanon | Xposure',
      description:
        'Apply to work with Xposure as a hostess, promoter or receptionist at events in Lebanon. Send your details and we’ll contact you about suitable roles.',
    },
    ar: {
      title: 'وظائف مضيفات ومروّجين في لبنان | Xposure',
      description:
        'قدّم طلبك للعمل مع Xposure كمضيفة أو مروّج أو موظف استقبال في فعاليات لبنان. أرسل بياناتك وسنتواصل معك عند توفّر فرصة مناسبة لك.',
    },
  },
};

for (const locale of ['en', 'ar'] as const) {
  const t = stringsFor(locale);
  const services = getServices(locale);
  const projects = getProjects(locale);

  add(locale, true, {
    path: '/',
    section: 'home',
    text: staticText.home[locale],
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
    text: staticText.about[locale],
    crumbs: [{ name: t.crumbs.about, path: '/about/' }],
    preloadImage: assetUrl('team'),
    render: () => <AboutPage />,
  });

  add(locale, true, {
    path: '/services/',
    section: 'services',
    text: staticText.services[locale],
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
    text: staticText.work[locale],
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
    text: staticText.contact[locale],
    crumbs: [{ name: t.crumbs.contact, path: '/contact/' }],
    render: () => <ContactPage />,
  });

  add(locale, true, {
    path: '/plan/',
    section: 'plan',
    text: staticText.plan[locale],
    crumbs: [{ name: t.crumbs.plan, path: '/plan/' }],
    render: () => <PlanPage />,
  });

  add(locale, true, {
    path: '/careers/',
    section: 'none',
    text: staticText.careers[locale],
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
  const found = table.get(path);
  if (found) return found;
  // Unknown Arabic URLs get the Arabic 404 text; everything else the English one.
  return splitLocale(path).locale === 'ar'
    ? { ...notFound, meta: { ...notFound.meta, locale: 'ar', title: 'الصفحة غير موجودة | Xposure' } }
    : notFound;
}

/** Every page, for prerendering and the sitemap. */
export function allRoutes(): Route[] {
  return [...table.values()];
}
