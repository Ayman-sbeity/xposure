import { site } from './content/site';
import { redirectFallbacks, redirects } from './content/redirects';
import { localeMeta, type Locale } from './i18n';

export type Crumb = { name: string; path: string };
type JsonLd = Record<string, unknown>;

export type PageMeta = {
  /** Canonical path with trailing slash, including the /ar prefix for Arabic pages. */
  path: string;
  locale: Locale;
  title: string;
  description: string;
  noindex?: boolean;
  /** The same page in each language (full paths). Used for hreflang and the language switch. */
  alternates?: Partial<Record<Locale, string>>;
  /** Trail after Home. The last item is the current page. Paths are full paths. */
  breadcrumbs?: Crumb[];
  homeCrumb?: Crumb;
  schema?: JsonLd[];
  /** Above-the-fold image to preload (LCP candidate). */
  preloadImage?: string;
};

export const absoluteUrl = (path: string): string => site.url + path;

export const organizationId = `${site.url}/#organization`;

/**
 * Organization data. Once the owner supplies a street address it becomes a LocalBusiness
 * with address, opening hours, map link and coordinates, which must match the Google
 * Business Profile exactly (same name, address and phone).
 */
function organization(): JsonLd {
  const local = Boolean(site.streetAddress);
  const node: JsonLd = {
    '@type': local ? 'LocalBusiness' : 'Organization',
    '@id': organizationId,
    name: site.name,
    url: `${site.url}/`,
    logo: absoluteUrl(site.logo.src),
    image: absoluteUrl(site.shareImage.src),
    email: site.email,
    telephone: site.phone,
    address: {
      '@type': 'PostalAddress',
      ...(site.streetAddress ? { streetAddress: site.streetAddress } : {}),
      ...(site.postalCode ? { postalCode: site.postalCode } : {}),
      addressLocality: site.locality,
      addressCountry: site.countryCode,
    },
    areaServed: { '@type': 'Country', name: site.countryName },
    sameAs: Object.values(site.socials),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: site.phone,
      email: site.email,
      areaServed: site.countryCode,
      availableLanguage: ['en', 'ar'],
    },
  };
  if (site.openingHours) node.openingHours = site.openingHours.map((h) => `${h.days} ${h.opens}-${h.closes}`);
  if (site.googleMapsUrl) node.hasMap = site.googleMapsUrl;
  if (site.geo) node.geo = { '@type': 'GeoCoordinates', ...site.geo };
  return node;
}

export const websiteSchema: JsonLd = {
  '@type': 'WebSite',
  '@id': `${site.url}/#website`,
  name: site.name,
  url: `${site.url}/`,
  inLanguage: site.arabicReviewed ? ['en', 'ar'] : 'en',
  publisher: { '@id': organizationId },
};

function breadcrumbSchema(home: Crumb, crumbs: Crumb[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [home, ...crumbs].map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Serialises JSON-LD so it can never close the surrounding <script> element. */
const safeJson = (value: unknown): string =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** Arabic pages stay out of search results until a native speaker has reviewed them. */
export function isIndexable(meta: PageMeta): boolean {
  if (meta.noindex || !site.indexable) return false;
  return meta.locale !== 'ar' || site.arabicReviewed;
}

export function robotsDirective(meta: PageMeta): string {
  return isIndexable(meta) ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
}

/** Head markup for a prerendered page. Values are escaped; JSON-LD is script-safe. */
export function buildHead(meta: PageMeta): string {
  const canonical = absoluteUrl(meta.path);
  const image = absoluteUrl(site.shareImage.src);
  const tags = [
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}"/>`,
    `<meta name="robots" content="${robotsDirective(meta)}"/>`,
  ];
  if (!meta.noindex) tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}"/>`);
  const alt = meta.alternates;
  if (site.arabicReviewed && alt?.en && alt.ar) {
    tags.push(
      `<link rel="alternate" hreflang="en" href="${escapeAttr(absoluteUrl(alt.en))}"/>`,
      `<link rel="alternate" hreflang="ar" href="${escapeAttr(absoluteUrl(alt.ar))}"/>`,
      `<link rel="alternate" hreflang="x-default" href="${escapeAttr(absoluteUrl(alt.en))}"/>`,
    );
  }
  tags.push(
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:site_name" content="${site.name}"/>`,
    `<meta property="og:locale" content="${localeMeta[meta.locale].ogLocale}"/>`,
    `<meta property="og:title" content="${escapeAttr(meta.title)}"/>`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}"/>`,
    `<meta property="og:url" content="${escapeAttr(canonical)}"/>`,
    `<meta property="og:image" content="${escapeAttr(image)}"/>`,
    `<meta property="og:image:width" content="${site.shareImage.width}"/>`,
    `<meta property="og:image:height" content="${site.shareImage.height}"/>`,
    `<meta property="og:image:alt" content="${escapeAttr(site.shareImage.alt)}"/>`,
    `<meta name="twitter:card" content="summary_large_image"/>`,
  );
  if (meta.preloadImage) {
    tags.push(`<link rel="preload" as="image" href="${escapeAttr(meta.preloadImage)}" fetchpriority="high"/>`);
  }
  if (!meta.noindex) {
    const graph: JsonLd[] = [organization(), ...(meta.schema ?? [])];
    if (meta.breadcrumbs?.length && meta.homeCrumb) graph.push(breadcrumbSchema(meta.homeCrumb, meta.breadcrumbs));
    tags.push(
      `<script type="application/ld+json">${safeJson({ '@context': 'https://schema.org', '@graph': graph })}</script>`,
    );
  }
  return tags.join('\n');
}

export function sitemapXml(metas: PageMeta[]): string {
  const urls = metas
    .filter((meta) => !meta.noindex && (meta.locale !== 'ar' || site.arabicReviewed))
    .map((meta) => `  <url><loc>${escapeAttr(absoluteUrl(meta.path))}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(): string {
  if (!site.indexable) {
    return '# Preview build: indexing is disabled.\n# Build with VITE_SITE_INDEXABLE=true only for the approved production deployment.\nUser-agent: *\nDisallow: /\n';
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`;
}

/** Netlify / Cloudflare Pages `_redirects` format. */
export function redirectsFile(): string {
  const lines = ['# Old WordPress URLs -> new pages (permanent).'];
  for (const [from, to] of redirects) {
    lines.push(`${from}  ${to}  301`);
    const alt = from.endsWith('/') ? from.slice(0, -1) : `${from}/`;
    lines.push(`${alt}  ${to}  301`);
  }
  for (const [from, to] of redirectFallbacks) lines.push(`${from}  ${to}  301`);
  return `${lines.join('\n')}\n`;
}

/** Netlify / Cloudflare Pages `_headers` format. */
export function headersFile(): string {
  const global = [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  X-Frame-Options: DENY',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
  ];
  if (!site.indexable) global.push('  X-Robots-Tag: noindex, nofollow');
  const lines = [...global, ''];
  if (site.indexable && !site.arabicReviewed) {
    lines.push('# Arabic pages await native-speaker review.', '/ar/*', '  X-Robots-Tag: noindex, nofollow', '');
  }
  lines.push(
    '# Hashed build output: safe to cache forever.',
    '/static/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '# Photography keeps its filename when replaced, so cache for a week.',
    '/assets/*',
    '  Cache-Control: public, max-age=604800',
    '',
  );
  return lines.join('\n');
}
