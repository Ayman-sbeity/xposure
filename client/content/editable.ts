// CONTENT THE ADMIN PANEL CAN EDIT.
//
// The files in client/content and client/i18n hold the DEFAULT content. The admin panel saves
// changes per section as "overrides"; applyContent() writes them over the defaults at runtime
// (on the server before rendering, and in the browser before hydrating), so an edit goes live
// immediately without a rebuild. "Reset to default" removes the override and the file's
// version returns.
//
// Each section turns the content modules into one editable document in which bilingual text
// is an { en, ar } pair, and writes a saved document back into the modules. validateSection()
// checks a document against the shape of the defaults, so a bad save can never break the site.

import { ar, en } from '../i18n/strings';
import { faqsAr, projectsAr, servicesAr, type ProjectText, type ServiceText } from './ar';
import { assets, type Asset } from './assets';
import { faqs, type Faq, type FaqId } from './faqs';
import { guides, type Guide } from './guides';
import { circleTints, slides, type Slide } from './home';
import { pageText, type PageKey } from './pages';
import { projects, type Project } from './projects';
import { services, type Service } from './services';
import { site } from './site';
import { stats } from './stats';
import { clientLogos, testimonials } from './trust';

// ---------------------------------------------------------------------------
// Types shared with the server and the admin panel
// ---------------------------------------------------------------------------
export type SectionId = 'business' | 'home' | 'services' | 'projects' | 'faqs' | 'stats' | 'trust' | 'seo' | 'text' | 'guides';

export type FieldHint = {
  kind?: 'image' | 'color' | 'link' | 'url' | 'email' | 'phone' | 'longtext' | 'select' | 'slug' | 'date' | 'time' | 'seoTitle' | 'seoDescription';
  label?: string;
  help?: string;
  options?: { value: string; label: string }[];
};

export type SectionInfo = {
  id: SectionId;
  title: string;
  description: string;
  /** Where to see this content on the website. */
  viewPath: string;
};

export type ContentOverrides = Partial<Record<SectionId, unknown>>;

export type MediaItem = { key: string; src: string; width: number; height: number; alt: string; altAr: string };

type Pair<T = string> = { en: T; ar: T };
type Doc = any; // eslint-disable-line @typescript-eslint/no-explicit-any -- validated by shape at runtime

type SectionDef = SectionInfo & {
  read: () => Doc;
  write: (doc: Doc) => void;
  /** Field hints keyed by path pattern ("*" matches any key or list position). */
  hints?: () => Record<string, FieldHint>;
  /** Blank item for lists that may start empty, keyed by the list's path pattern ('' = the document itself). */
  templates?: Record<string, unknown>;
  check?: (doc: Doc) => string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const pair = (en: string, ar?: string): Pair => ({ en, ar: ar ?? '' });
const pairList = (en: string[], ar?: string[]): Pair<string[]> => ({ en: [...en], ar: ar ? [...ar] : [] });

/** Replace an array's contents in place (modules keep their own reference). */
function replaceArray<T>(target: T[], items: T[]): void {
  target.splice(0, target.length, ...items);
}
/** Replace an object's keys in place. */
function replaceRecord<T>(target: Record<string, T>, next: Record<string, T>): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, next);
}
/** Copy `source` onto `target`, recursing into plain objects; text and lists are replaced. */
function assignDeep(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      assignDeep(current as Record<string, unknown>, value as Record<string, unknown>);
    } else target[key] = value;
  }
}

const isPairShape = (value: unknown): value is Pair<unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && 'en' in value && 'ar' in value;

/** English and Arabic trees of the same shape -> one tree with { en, ar } leaves. */
function pairTree(enValue: unknown, arValue: unknown): unknown {
  if (typeof enValue === 'string') return { en: enValue, ar: typeof arValue === 'string' ? arValue : '' };
  if (Array.isArray(enValue)) {
    if (enValue.every((item) => typeof item === 'string')) return { en: [...enValue], ar: Array.isArray(arValue) ? [...arValue] : [] };
    return enValue.map((item, i) => pairTree(item, Array.isArray(arValue) ? arValue[i] : undefined));
  }
  if (enValue && typeof enValue === 'object') {
    const arObject = (arValue ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(enValue).map(([key, value]) => [key, pairTree(value, arObject[key])]));
  }
  return enValue;
}
/** Arabic text left empty shows the English instead (also inside lists). */
function withFallback(enValue: unknown, arValue: unknown): unknown {
  if (typeof enValue === 'string') return typeof arValue === 'string' && arValue.trim() ? arValue : enValue;
  if (Array.isArray(enValue)) {
    const arList = Array.isArray(arValue) ? arValue : [];
    if (enValue.every((item) => typeof item === 'string')) {
      const lines = arList.filter((line) => typeof line === 'string' && line.trim());
      return lines.length ? lines : enValue;
    }
    return enValue.map((item, i) => withFallback(item, arList[i]));
  }
  if (enValue && typeof enValue === 'object') {
    const arObject = (arValue ?? {}) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(enValue).map(([key, value]) => [key, withFallback(value, arObject[key])]));
  }
  return arValue ?? enValue;
}

/** The reverse of pairTree. */
function unpairTree(doc: unknown): [unknown, unknown] {
  if (isPairShape(doc)) return [doc.en, doc.ar];
  if (Array.isArray(doc)) {
    const pairs = doc.map(unpairTree);
    return [pairs.map((p) => p[0]), pairs.map((p) => p[1])];
  }
  if (doc && typeof doc === 'object') {
    const enOut: Record<string, unknown> = {};
    const arOut: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(doc)) [enOut[key], arOut[key]] = unpairTree(value);
    return [enOut, arOut];
  }
  return [doc, doc];
}

/** Arabic text falls back to English when left empty, so a page never shows a blank. */
function arabic<T extends Record<string, unknown>>(fields: Record<string, Pair<string> | Pair<string[]>>): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const text = value.ar;
    if (Array.isArray(text)) {
      const lines = text.filter((line) => line.trim());
      if (lines.length) out[key] = lines;
    } else if (text.trim()) out[key] = text;
  }
  return out as Partial<T>;
}

const isHttps = (value: string) => /^https:\/\/[^\s]+$/.test(value);
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const isLink = (value: string) => value.startsWith('/') || isHttps(value);
const imageExists = (key: string) => key in assets;

const image: FieldHint = { kind: 'image' };
const seoTitle: FieldHint = { kind: 'seoTitle', help: 'Shown as the page title in Google. Aim for 60 characters or fewer.' };
const seoDescription: FieldHint = { kind: 'seoDescription', help: 'Shown under the title in Google. Aim for 110–160 characters.' };
const longtext: FieldHint = { kind: 'longtext' };
const serviceOptions = () => services.map((s) => ({ value: s.slug, label: s.name }));
const projectOptions = () => [{ value: '', label: 'None' }, ...projects.map((p) => ({ value: p.slug, label: p.client }))];

function uniqueSlugs(items: { slug: string }[], what: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!isSlug(item.slug)) errors.push(`${what} address "${item.slug}" may only use lowercase letters, numbers and dashes.`);
    if (seen.has(item.slug)) errors.push(`Two ${what.toLowerCase()}s use the address "${item.slug}".`);
    seen.add(item.slug);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
const SECTIONS: SectionDef[] = [
  {
    id: 'business',
    title: 'Business details',
    description: 'Phone, WhatsApp, email, social links, address and opening hours used across the site, the chat and Google data.',
    viewPath: '/contact/',
    read: () => ({
      email: site.email,
      phone: site.phone,
      phoneDisplay: site.phoneDisplay,
      whatsappNumber: site.whatsappNumber,
      instagram: site.socials.instagram,
      linkedin: site.socials.linkedin,
      streetAddress: site.streetAddress ?? '',
      postalCode: site.postalCode ?? '',
      googleMapsUrl: site.googleMapsUrl ?? '',
      openingHours: (site.openingHours ?? []).map((h) => ({ ...h })),
      responsePromise: pair(site.responsePromise?.en ?? '', site.responsePromise?.ar ?? ''),
      companyProfilePdf: site.companyProfilePdf ?? '',
    }),
    write: (d) => {
      site.email = d.email;
      site.phone = d.phone;
      site.phoneDisplay = d.phoneDisplay;
      site.whatsappNumber = d.whatsappNumber;
      site.socials.instagram = d.instagram;
      site.socials.linkedin = d.linkedin;
      site.streetAddress = d.streetAddress || null;
      site.postalCode = d.postalCode || null;
      site.googleMapsUrl = d.googleMapsUrl || null;
      site.openingHours = d.openingHours.length ? d.openingHours : null;
      site.responsePromise = d.responsePromise.en || d.responsePromise.ar ? d.responsePromise : null;
      site.companyProfilePdf = d.companyProfilePdf || null;
    },
    hints: () => ({
      email: { kind: 'email', label: 'Email address' },
      phone: { kind: 'phone', label: 'Phone (for call links)', help: 'International format without spaces, e.g. +96176853602.' },
      phoneDisplay: { label: 'Phone (as shown)', help: 'How the number is written on the site, e.g. +961 76 853 602.' },
      whatsappNumber: { kind: 'phone', label: 'WhatsApp number', help: 'Digits only, with the country code: 96176853602.' },
      instagram: { kind: 'url', label: 'Instagram link' },
      linkedin: { kind: 'url', label: 'LinkedIn link' },
      streetAddress: { label: 'Street address', help: 'Leave empty to hide. Must match the Google Business Profile exactly.' },
      postalCode: { label: 'Postal code' },
      googleMapsUrl: { kind: 'url', label: 'Google Maps link', help: 'The "Share" link of your Google Maps listing.' },
      openingHours: { label: 'Opening hours', help: 'Leave empty to hide.' },
      'openingHours.*.days': { label: 'Days', help: 'Day codes, e.g. Mo-Fr or Sa.' },
      'openingHours.*.opens': { kind: 'time', label: 'Opens' },
      'openingHours.*.closes': { kind: 'time', label: 'Closes' },
      responsePromise: { label: 'Response-time promise', help: 'e.g. "We reply within one working day". Leave empty to hide.' },
      companyProfilePdf: { kind: 'link', label: 'Company profile PDF', help: 'Path of a PDF placed in /public, e.g. /xposure-profile.pdf. Leave empty to hide.' },
    }),
    templates: { openingHours: { days: 'Mo-Fr', opens: '09:00', closes: '18:00' } },
    check: (d) => {
      const errors: string[] = [];
      if (!isEmail(d.email)) errors.push('The email address is not valid.');
      if (!/^\+\d{8,15}$/.test(d.phone)) errors.push('Phone (for call links) must look like +96176853602.');
      if (!/^\d{8,15}$/.test(d.whatsappNumber)) errors.push('WhatsApp number must be digits only, with the country code.');
      for (const key of ['instagram', 'linkedin', 'googleMapsUrl'] as const) if (d[key] && !isHttps(d[key])) errors.push(`The ${key} link must start with https://`);
      if (d.companyProfilePdf && !d.companyProfilePdf.startsWith('/')) errors.push('The company profile path must start with /');
      for (const h of d.openingHours) if (!/^\d{2}:\d{2}$/.test(h.opens) || !/^\d{2}:\d{2}$/.test(h.closes)) errors.push('Opening hours use 24-hour times such as 09:00.');
      return errors;
    },
  },
  {
    id: 'home',
    title: 'Home page slider',
    description: 'The full-screen photos at the top of the home page: photo, caption, small label, button and link. Plus the colours of the round service photos.',
    viewPath: '/',
    read: () => ({ slides: clone(slides), circleColors: [...circleTints] }),
    write: (d) => {
      replaceArray(slides, d.slides as Slide[]);
      replaceArray(circleTints, d.circleColors);
    },
    hints: () => ({
      slides: { label: 'Slides', help: 'Wide photos work best. Use the arrows to change the order.' },
      'slides.*.image': image,
      'slides.*.link': { kind: 'link', help: 'Where the button goes, e.g. /plan/ or /work/.' },
      circleColors: { label: 'Service circle colours', help: 'One colour per service, in order.' },
      'circleColors.*': { kind: 'color' },
    }),
    check: (d) => {
      const errors: string[] = [];
      if (!d.slides.length) errors.push('Keep at least one slide.');
      for (const s of d.slides) {
        if (!imageExists(s.image)) errors.push(`Slide photo "${s.image}" was not found in the media library.`);
        if (!isLink(s.link)) errors.push(`Slide link "${s.link}" must start with / or https://`);
      }
      for (const color of d.circleColors) if (!/^#[0-9a-f]{6}$/i.test(color)) errors.push(`"${color}" is not a colour such as #c2188f.`);
      return errors;
    },
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Each service page: name, summary, what is included, who it is ideal for, the photo and its Google title.',
    viewPath: '/services/',
    read: () =>
      services.map((s) => {
        const a: Partial<ServiceText> = servicesAr[s.slug] ?? {};
        return {
          slug: s.slug,
          image: s.image,
          relatedProject: s.relatedProject ?? '',
          name: pair(s.name, a.name),
          tag: pair(s.tag, a.tag),
          summary: pair(s.summary, a.summary),
          details: pairList(s.details, a.details),
          headingMain: pair(s.heading.main, a.heading?.main),
          headingAccent: pair(s.heading.accent, a.heading?.accent),
          intro: pair(s.intro, a.intro),
          body: pairList(s.body, a.body),
          idealFor: pairList(s.idealFor, a.idealFor),
          metaTitle: pair(s.metaTitle, a.metaTitle),
          metaDescription: pair(s.metaDescription, a.metaDescription),
        };
      }),
    write: (d) => {
      const previous = new Map(services.map((s) => [s.slug, s]));
      replaceArray(
        services,
        d.map(
          (x: Doc): Service => ({
            slug: x.slug,
            name: x.name.en,
            tag: x.tag.en,
            summary: x.summary.en,
            details: x.details.en,
            image: x.image,
            heading: { main: x.headingMain.en, accent: x.headingAccent.en },
            intro: x.intro.en,
            body: x.body.en,
            idealFor: x.idealFor.en,
            ...(x.relatedProject ? { relatedProject: x.relatedProject } : {}),
            metaTitle: x.metaTitle.en,
            metaDescription: x.metaDescription.en,
            source: previous.get(x.slug)?.source ?? '',
          }),
        ),
      );
      const arTexts: Record<string, ServiceText> = {};
      for (const x of d) {
        const text = arabic<ServiceText>({
          name: x.name,
          tag: x.tag,
          summary: x.summary,
          details: x.details,
          intro: x.intro,
          body: x.body,
          idealFor: x.idealFor,
          metaTitle: x.metaTitle,
          metaDescription: x.metaDescription,
        });
        if (x.headingMain.ar || x.headingAccent.ar) text.heading = { main: x.headingMain.ar || x.headingMain.en, accent: x.headingAccent.ar || x.headingAccent.en };
        arTexts[x.slug] = text as ServiceText;
      }
      replaceRecord(servicesAr, arTexts);
    },
    hints: () => ({
      '*.slug': { kind: 'slug', label: 'Page address', help: 'Used in the link: /services/<address>/. Changing it changes the page address.' },
      '*.image': image,
      '*.relatedProject': { kind: 'select', label: 'Related project', options: projectOptions() },
      '*.tag': { label: 'Small heading' },
      '*.summary': longtext,
      '*.details': { label: 'What is included' },
      '*.headingMain': { label: 'Page heading' },
      '*.headingAccent': { label: 'Page heading (bold part)' },
      '*.intro': longtext,
      '*.body': { label: 'Paragraphs', kind: 'longtext' },
      '*.idealFor': { label: 'Ideal for' },
      '*.metaTitle': { ...seoTitle, label: 'Google title' },
      '*.metaDescription': { ...seoDescription, label: 'Google description' },
    }),
    check: (d) => {
      const errors = uniqueSlugs(d, 'Service');
      if (!d.length) errors.push('Keep at least one service.');
      for (const s of d) if (!imageExists(s.image)) errors.push(`Photo "${s.image}" was not found in the media library.`);
      return errors;
    },
  },
  {
    id: 'projects',
    title: 'Projects (Our work)',
    description: 'Portfolio projects: story, what Xposure delivered, photos and approved results.',
    viewPath: '/work/',
    read: () =>
      projects.map((p) => {
        const a: Partial<ProjectText> = projectsAr[p.slug] ?? {};
        return {
          slug: p.slug,
          type: p.type,
          year: p.year,
          date: p.date,
          cover: p.cover,
          gallery: [...p.gallery],
          services: [...p.services],
          client: pair(p.client, a.client),
          title: pair(p.title, a.title),
          summary: pair(p.summary, a.summary),
          body: pairList(p.body, a.body),
          delivered: pairList(p.delivered, a.delivered),
          results: p.results.map((r) => ({ value: r.value, label: pair(r.label.en, r.label.ar), approved: r.approved })),
          metaTitle: pair(p.metaTitle, a.metaTitle),
          metaDescription: pair(p.metaDescription, a.metaDescription),
        };
      }),
    write: (d) => {
      const previous = new Map(projects.map((p) => [p.slug, p]));
      replaceArray(
        projects,
        d.map(
          (x: Doc): Project => ({
            slug: x.slug,
            client: x.client.en,
            title: x.title.en,
            type: x.type,
            year: x.year,
            date: x.date,
            cover: x.cover,
            gallery: x.gallery,
            summary: x.summary.en,
            body: x.body.en,
            delivered: x.delivered.en,
            services: x.services,
            results: x.results,
            video: previous.get(x.slug)?.video ?? null,
            metaTitle: x.metaTitle.en,
            metaDescription: x.metaDescription.en,
            source: previous.get(x.slug)?.source ?? '',
          }),
        ),
      );
      replaceRecord(
        projectsAr,
        Object.fromEntries(
          d.map((x: Doc) => [
            x.slug,
            arabic<ProjectText>({
              client: x.client,
              title: x.title,
              summary: x.summary,
              body: x.body,
              delivered: x.delivered,
              metaTitle: x.metaTitle,
              metaDescription: x.metaDescription,
            }) as ProjectText,
          ]),
        ),
      );
    },
    hints: () => ({
      '*.slug': { kind: 'slug', label: 'Page address', help: 'Used in the link: /work/<address>/.' },
      '*.type': { kind: 'select', options: [{ value: 'Events', label: 'Event' }, { value: 'Exhibitions', label: 'Exhibition' }] },
      '*.date': { kind: 'date' },
      '*.cover': { ...image, label: 'Cover photo' },
      '*.gallery': { label: 'Gallery photos' },
      '*.gallery.*': image,
      '*.services': { label: 'Services involved' },
      '*.services.*': { kind: 'select', options: serviceOptions() },
      '*.client': { label: 'Client / event name' },
      '*.title': { label: 'Headline' },
      '*.summary': longtext,
      '*.body': { label: 'The story', kind: 'longtext' },
      '*.delivered': { label: 'What Xposure delivered' },
      '*.results': { label: 'Results', help: 'Only results marked approved are shown, and only with the client’s written agreement.' },
      '*.metaTitle': { ...seoTitle, label: 'Google title' },
      '*.metaDescription': { ...seoDescription, label: 'Google description' },
    }),
    templates: { '*.gallery': '', '*.services': '', '*.results': { value: '', label: { en: '', ar: '' }, approved: false } },
    check: (d) => {
      const errors = uniqueSlugs(d, 'Project');
      for (const p of d) {
        if (!['Events', 'Exhibitions'].includes(p.type)) errors.push(`Project "${p.slug}" must be an Event or an Exhibition.`);
        for (const key of [p.cover, ...p.gallery]) if (!imageExists(key)) errors.push(`Photo "${key}" was not found in the media library.`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) errors.push(`Project "${p.slug}" needs a date such as 2024-04-13.`);
      }
      return errors;
    },
  },
  {
    id: 'faqs',
    title: 'Questions & answers',
    description: 'The FAQ shown on the home, contact and planning pages. The chat assistant also uses these answers.',
    viewPath: '/contact/',
    read: () =>
      faqs.map((f, i) => ({
        id: f.id ?? '',
        question: pair(f.q, faqsAr[i]?.q),
        answer: pair(f.a, faqsAr[i]?.a),
      })),
    write: (d) => {
      const id = (x: Doc) => (x.id ? { id: x.id as FaqId } : {});
      replaceArray(faqs, d.map((x: Doc): Faq => ({ ...id(x), q: x.question.en, a: x.answer.en })));
      replaceArray(faqsAr, d.map((x: Doc): Faq => ({ ...id(x), q: x.question.ar || x.question.en, a: x.answer.ar || x.answer.en })));
    },
    hints: () => ({
      '*.id': {
        kind: 'select',
        label: 'Used by the chat for',
        help: 'Lets the chat assistant reuse this answer.',
        options: [
          { value: '', label: 'Nothing' },
          { value: 'services', label: 'What we offer' },
          { value: 'location', label: 'Where we are' },
          { value: 'combine', label: 'Combining services' },
          { value: 'brief', label: 'What to include in an enquiry' },
          { value: 'start', label: 'How to get started' },
        ],
      },
      '*.answer': longtext,
    }),
    templates: { '': { id: '', question: { en: '', ar: '' }, answer: { en: '', ar: '' } } },
  },
  {
    id: 'stats',
    title: 'Key figures',
    description: '"Xposure in numbers" on the home page, with a count-up animation. Only approved, provable figures are shown.',
    viewPath: '/',
    read: () =>
      stats.map((s) => ({ value: s.value, prefix: s.prefix ?? '', suffix: s.suffix ?? '', label: pair(s.label.en, s.label.ar), approved: s.approved, source: s.source })),
    write: (d) =>
      replaceArray(
        stats,
        d.map((x: Doc) => ({ value: x.value, ...(x.prefix ? { prefix: x.prefix } : {}), ...(x.suffix ? { suffix: x.suffix } : {}), label: x.label, approved: x.approved, source: x.source })),
      ),
    hints: () => ({
      '*.value': { label: 'Number' },
      '*.suffix': { help: 'Shown after the number, e.g. + or %.' },
      '*.approved': { label: 'Show on the website', help: 'Tick only for figures you can prove.' },
      '*.source': { label: 'Source (not shown)', help: 'Where the figure comes from, for the team.' },
    }),
    templates: { '': { value: 0, prefix: '', suffix: '+', label: { en: '', ar: '' }, approved: false, source: '' } },
  },
  {
    id: 'trust',
    title: 'Testimonials & client logos',
    description: 'Client quotes and logos. Shown only when approved, with the client’s written permission.',
    viewPath: '/',
    read: () => ({
      testimonials: testimonials.map((t) => ({ quote: pair(t.quote.en, t.quote.ar), name: t.name, role: pair(t.role.en, t.role.ar), company: t.company, approved: t.approved, source: t.source })),
      logos: clientLogos.map((l) => ({ name: l.name, logo: l.logo, category: pair(l.category.en, l.category.ar), approved: l.approved })),
    }),
    write: (d) => {
      replaceArray(testimonials, d.testimonials);
      replaceArray(clientLogos, d.logos);
    },
    hints: () => ({
      'testimonials.*.quote': longtext,
      'testimonials.*.approved': { label: 'Show on the website', help: 'Only with the client’s written permission.' },
      'testimonials.*.source': { label: 'Source (not shown)' },
      'logos.*.logo': image,
      'logos.*.category': { help: 'The tab the logo appears under.' },
      'logos.*.approved': { label: 'Show on the website' },
    }),
    templates: {
      testimonials: { quote: { en: '', ar: '' }, name: '', role: { en: '', ar: '' }, company: '', approved: false, source: '' },
      logos: { name: '', logo: 'team', category: { en: '', ar: '' }, approved: false },
    },
    check: (d) => d.logos.filter((l: Doc) => !imageExists(l.logo)).map((l: Doc) => `Logo "${l.logo}" was not found in the media library.`),
  },
  {
    id: 'seo',
    title: 'Page titles & SEO',
    description: 'The Google title and description of each main page, in both languages.',
    viewPath: '/',
    read: () =>
      Object.fromEntries(
        Object.entries(pageText).map(([key, value]) => [key, { title: pair(value.en.title, value.ar.title), description: pair(value.en.description, value.ar.description) }]),
      ),
    write: (d) => {
      for (const key of Object.keys(pageText) as PageKey[]) {
        pageText[key].en = { title: d[key].title.en, description: d[key].description.en };
        pageText[key].ar = { title: d[key].title.ar || d[key].title.en, description: d[key].description.ar || d[key].description.en };
      }
    },
    hints: () => ({ '*.title': seoTitle, '*.description': seoDescription }),
  },
  {
    id: 'text',
    title: 'All website wording',
    description: 'Every heading, button, menu item, form label and chat answer, in English and Arabic.',
    viewPath: '/',
    read: () => pairTree(en, ar),
    write: (d) => {
      const [enText, arText] = unpairTree(d);
      assignDeep(en as unknown as Record<string, unknown>, enText as Record<string, unknown>);
      assignDeep(ar as unknown as Record<string, unknown>, withFallback(enText, arText) as Record<string, unknown>);
    },
    check: (d) => placeholderErrors(defaults.text, d),
  },
  {
    id: 'guides',
    title: 'Guides (English)',
    description: 'Practical planning guides published under /guides/.',
    viewPath: '/guides/',
    read: () =>
      guides.map((g) => ({
        ...clone(g),
        sections: g.sections.map((s) => ({ heading: s.heading, paragraphs: [...(s.paragraphs ?? [])], list: [...(s.list ?? [])] })),
      })),
    write: (d) =>
      replaceArray(
        guides,
        d.map(
          (g: Doc): Guide => ({
            ...g,
            sections: g.sections.map((s: Doc) => ({ heading: s.heading, ...(s.paragraphs.length ? { paragraphs: s.paragraphs } : {}), ...(s.list.length ? { list: s.list } : {}) })),
          }),
        ),
      ),
    hints: () => ({
      '*.slug': { kind: 'slug', label: 'Page address' },
      '*.description': seoDescription,
      '*.intro': longtext,
      '*.metaTitle': { ...seoTitle, label: 'Google title' },
      '*.published': { kind: 'date' },
      '*.sections.*.paragraphs.*': longtext,
      '*.relatedServices.*': { kind: 'select', options: serviceOptions() },
    }),
    templates: { '*.sections': { heading: '', paragraphs: [''], list: [] }, '*.sections.*.paragraphs': '', '*.sections.*.list': '', '*.relatedServices': '' },
    check: (d) => uniqueSlugs(d, 'Guide'),
  },
];

const BY_ID = new Map(SECTIONS.map((section) => [section.id, section]));

// The files' own content, captured before any override is applied.
const defaults = Object.fromEntries(SECTIONS.map((section) => [section.id, clone(section.read())])) as Record<SectionId, Doc>;

/** Wording with {placeholders} (e.g. "Step {n} of {total}") must keep them. */
function placeholderErrors(defaultDoc: unknown, doc: unknown, path = ''): string[] {
  if (isPairShape(defaultDoc) && typeof defaultDoc.en === 'string' && isPairShape(doc)) {
    const needed = defaultDoc.en.match(/\{\w+\}/g) ?? [];
    return (['en', 'ar'] as const).flatMap((lang) => {
      const text = String(doc[lang] ?? '');
      if (lang === 'ar' && !text) return [];
      const missing = needed.filter((p) => !text.includes(p));
      return missing.length ? [`"${path}" (${lang === 'en' ? 'English' : 'Arabic'}) must keep ${missing.join(', ')}.`] : [];
    });
  }
  if (defaultDoc && typeof defaultDoc === 'object' && doc && typeof doc === 'object' && !Array.isArray(defaultDoc)) {
    return Object.keys(defaultDoc).flatMap((key) =>
      placeholderErrors((defaultDoc as Record<string, unknown>)[key], (doc as Record<string, unknown>)[key], path ? `${path}.${key}` : key),
    );
  }
  return [];
}

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------
const MAX_TEXT = 12000;
const MAX_ITEMS = 300;

const patternOf = (path: string[]) => path.map((part) => (/^\d+$/.test(part) ? '*' : part)).join('.');
function matches(pattern: string, path: string): boolean {
  const a = pattern.split('.');
  const b = path.split('.');
  return a.length === b.length && a.every((part, i) => part === '*' || part === b[i]);
}

function conform(template: unknown, value: unknown, path: string[], def: SectionDef, errors: string[]): void {
  if (errors.length > 20) return;
  const where = path.join(' › ') || 'content';
  if (typeof template === 'string') {
    if (typeof value !== 'string') errors.push(`${where}: expected text.`);
    else if (value.length > MAX_TEXT) errors.push(`${where}: text is too long.`);
    return;
  }
  if (typeof template === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${where}: expected a number.`);
    return;
  }
  if (typeof template === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${where}: expected yes or no.`);
    return;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(value)) return void errors.push(`${where}: expected a list.`);
    if (value.length > MAX_ITEMS) return void errors.push(`${where}: too many items.`);
    const pattern = patternOf(path);
    const key = Object.keys(def.templates ?? {}).find((p) => (p === '' ? pattern === '' : matches(p, pattern)));
    const item = key !== undefined ? def.templates![key] : template.length ? template[0] : '';
    value.forEach((entry, i) => conform(item, entry, [...path, String(i)], def, errors));
    return;
  }
  if (template && typeof template === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return void errors.push(`${where}: expected a group of fields.`);
    const expected = Object.keys(template);
    const extra = Object.keys(value).filter((key) => !expected.includes(key));
    if (extra.length) errors.push(`${where}: unexpected field ${extra.join(', ')}.`);
    for (const key of expected) {
      if (!(key in value)) errors.push(`${where}: missing ${key}.`);
      else conform((template as Record<string, unknown>)[key], (value as Record<string, unknown>)[key], [...path, key], def, errors);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API (used by the server through entry-server, and by the browser in main.tsx)
// ---------------------------------------------------------------------------
let version = 0;
/** Increases whenever content changes, so derived data (the route table) can rebuild. */
export const contentVersion = (): number => version;

export function listSections(): SectionInfo[] {
  return SECTIONS.map(({ id, title, description, viewPath }) => ({ id, title, description, viewPath }));
}

export const isSectionId = (value: string): value is SectionId => BY_ID.has(value as SectionId);

/** Everything the editor needs for one section. */
export function describeSection(id: SectionId, saved: unknown) {
  const def = BY_ID.get(id)!;
  return {
    id,
    title: def.title,
    description: def.description,
    viewPath: def.viewPath,
    doc: saved ?? clone(defaults[id]),
    defaults: clone(defaults[id]),
    hints: def.hints?.() ?? {},
    templates: def.templates ?? {},
    customized: saved !== undefined && saved !== null,
  };
}

/** Problems with a document, in plain English. Empty when it is safe to save. */
export function validateSection(id: SectionId, doc: unknown): string[] {
  const def = BY_ID.get(id);
  if (!def) return ['Unknown section.'];
  const errors: string[] = [];
  conform(defaults[id], doc, [], def, errors);
  if (errors.length) return errors;
  return def.check?.(doc) ?? [];
}

/** Write overrides (or the defaults, for sections without one) into the content modules. */
export function applyContent(overrides: ContentOverrides): void {
  for (const def of SECTIONS) {
    const doc = overrides[def.id];
    def.write(clone(doc !== undefined && doc !== null ? doc : defaults[def.id]));
  }
  version += 1;
}

/** Make uploaded images available to <Photo> and the image fields. */
export function registerMedia(items: MediaItem[]): void {
  const registry = assets as Record<string, Asset>;
  for (const key of Object.keys(registry)) if (key.startsWith('upload-')) delete registry[key];
  for (const item of items) registry[item.key] = { file: '', src: item.src, width: item.width, height: item.height, alt: item.alt, altAr: item.altAr };
  version += 1;
}

/** Every image the editor can choose from (built-in photos first, then uploads). */
export function listImages(): MediaItem[] {
  return Object.entries(assets as Record<string, Asset>).map(([key, asset]) => ({
    key,
    src: asset.src ?? `/assets/${asset.file}`,
    width: asset.width,
    height: asset.height,
    alt: asset.alt,
    altAr: asset.altAr,
  }));
}
