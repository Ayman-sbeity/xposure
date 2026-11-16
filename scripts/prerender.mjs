// Writes a fully rendered HTML file for every route (English and Arabic), plus 404.html,
// sitemap.xml, robots.txt and host config (_redirects, _headers). Runs after both Vite builds.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as ssr from '../.ssr/entry-server.js';

const HEAD = '<!--app-head-->';
const ROOT = '<div id="root"></div>';
const HTML_TAG = '<html lang="en">';
const template = await readFile('dist/index.html', 'utf8');
for (const marker of [HEAD, ROOT, HTML_TAG]) {
  if (!template.includes(marker)) throw new Error(`dist/index.html is missing ${marker}`);
}
if (!/<title>[^<]*<\/title>/.test(template)) throw new Error('dist/index.html is missing <title>');
// The Node server renders pages from this untouched template (dist/index.html is replaced below).
await mkdir('.ssr', { recursive: true });
await writeFile('.ssr/template.html', template);

function page(path) {
  const { html, head, lang, dir } = ssr.render(path);
  return template
    .replace(HTML_TAG, () => `<html lang="${lang}" dir="${dir}">`)
    .replace(/<title>[^<]*<\/title>\s*/, '')
    .replace(HEAD, () => head)
    .replace(ROOT, () => `<div id="root">${html}</div>`);
}

const paths = ssr.routePaths();
for (const path of paths) {
  const file = join('dist', path, 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(path));
}
await writeFile('dist/404.html', page('/404/'));
await writeFile('dist/sitemap.xml', ssr.sitemap());
await writeFile('dist/robots.txt', ssr.robotsTxt());
await writeFile('dist/_redirects', ssr.redirectsFile());
await writeFile('dist/_headers', ssr.headersFile());

console.log(`Prerendered ${paths.length} pages + 404.html, sitemap.xml, robots.txt, _redirects, _headers`);
