import { renderToString } from 'react-dom/server';
import App from './App';
import { localeMeta } from './i18n';
import { allRoutes, resolveRoute } from './routes';
import { buildHead, headersFile, redirectsFile, robotsTxt, sitemapXml } from './seo';

/** Build-time render of one page: body markup, its <head> tags and <html> attributes. */
export function render(path: string): { html: string; head: string; lang: string; dir: string } {
  const route = resolveRoute(path);
  const { lang, dir } = localeMeta[route.meta.locale];
  return { html: renderToString(<App path={path} />), head: buildHead(route.meta), lang, dir };
}

export { headersFile, redirectsFile, robotsTxt };

export const routePaths = (): string[] => allRoutes().map((route) => route.meta.path);

export const sitemap = (): string => sitemapXml(allRoutes().map((route) => route.meta));
