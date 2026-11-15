// 301 map from the WordPress URLs captured in source-export/content/pages.json to the
// new pages. Verify against Search Console / server logs before launch and add any
// other indexed URLs found there.
export const redirects: [from: string, to: string][] = [
  ['/index.php', '/'],
  ['/index.php/xposure-hostess-company-in-lebanon/', '/about/'],
  ['/index.php/xposure-services/', '/services/'],
  ['/index.php/portfolio/xposure-portfolio/', '/work/'],
  ['/index.php/contact/', '/contact/'],
  ['/index.php/portfolios/xposures-success-at-horeca-exhibition-2024/', '/work/horeca-exhibition-2024/'],
  [
    '/index.php/portfolios/ezzeddine-plus-iftar-an-evening-of-exquisite-elegance-organized-by-xposure/',
    '/work/ezzeddine-plus-iftar-2024/',
  ],
];

// Fallback for other old portfolio posts that were not part of the export.
export const redirectFallbacks: [from: string, to: string][] = [['/index.php/portfolios/*', '/work/']];
