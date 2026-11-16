import { renderToString } from 'react-dom/server';
import App from './App';
import { applyContent, describeSection, isSectionId, listImages, listSections, registerMedia, validateSection } from './content/editable';
import { redirectFallbacks, redirects } from './content/redirects';
import { site } from './content/site';
import { localeMeta } from './i18n';
import { allRoutes, resolveRoute } from './routes';
import { runtime } from './runtime';
import { buildHead, headersFile, redirectsFile, robotsTxt, sitemapXml } from './seo';

/** Render one page: body markup, its <head> tags, <html> attributes and HTTP status. */
export function render(path: string): { html: string; head: string; lang: string; dir: string; status: number } {
  const route = resolveRoute(path);
  const { lang, dir } = localeMeta[route.meta.locale];
  return {
    html: renderToString(<App path={path} />),
    head: buildHead(route.meta),
    lang,
    dir,
    status: route.meta.path === '/404/' ? 404 : 200,
  };
}

/** Called by the Node server: forms save to the admin inbox and meeting booking is on. */
export function setRuntime(options: { api: boolean }): void {
  runtime.api = options.api;
}

/** Content editing, used by the admin API. */
export const content = {
  listSections,
  describeSection,
  validateSection,
  isSectionId,
  apply: applyContent,
  registerMedia,
  listImages,
};

/** Current business details (after content overrides), for the server. */
export const business = () => ({
  name: site.name,
  email: site.email,
  phone: site.phone,
  phoneDisplay: site.phoneDisplay,
  whatsappNumber: site.whatsappNumber,
  url: site.url,
  indexable: site.indexable,
  arabicReviewed: site.arabicReviewed,
});

export const redirectRules = { exact: redirects, fallbacks: redirectFallbacks };

export { headersFile, redirectsFile, robotsTxt };

export const routePaths = (): string[] => allRoutes().map((route) => route.meta.path);

export const sitemap = (): string => sitemapXml(allRoutes().map((route) => route.meta));
