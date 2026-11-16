# Xposure website + admin panel — React, TypeScript, Node.js

> **15 November 2026:** the site now runs on a small Node.js server with an **admin panel** at `/admin/`: an inbox for every enquiry, event brief and job application; **Zoom meeting booking** with availability settings; editing of **all website content** in English and Arabic (with version history); a media library; an activity log. Forms save to the inbox; nothing depends on the visitor pressing send in their email app any more. The old MongoDB API in `server/` was replaced. The site still works as a plain static export (forms then fall back to WhatsApp/email drafts, booking is hidden).
>
> The visual design follows a white, minimal agency style set in `client/theme.css`. **To edit content without code, use the admin panel; for everything else read `EDITING.md`.**

## Quick start

Use Node.js 22.18 or newer (24 was used for this build). There is nothing else to install: the database is SQLite, built into Node.

```sh
npm ci
npm run dev        # website + admin with instant reload: http://localhost:5173
```

The first start creates an admin account and prints its password (also saved in `data/ADMIN-LOGIN.txt`). Sign in at http://localhost:5173/admin/ and change the password in Settings.

Production:

```sh
npm run build      # type-checks everything, builds the site, the admin and the server bundle
npm test           # 20 server tests (time zones, booking, security, content publishing)
npm start          # http://localhost:3000 (set PORT to change)
```

## How it works

| Part | Where | What it does |
| --- | --- | --- |
| Website | `client/` | React pages, rendered on the server for every request (full HTML for search engines), then hydrated. |
| Server | `server/src/` | Express 5 app run directly by Node (TypeScript type-stripping, no build step): page rendering, the public API, the admin API, uploads, security headers. |
| Admin panel | `admin/` | React app at `/admin/` (dashboard, inbox, meetings, content, media, activity, settings). |
| Database | `data/xposure.db` | SQLite file: messages, meetings, content edits and their history, uploaded images, admins, sessions, activity. Uploads are in `data/uploads/`. **Back up the `data/` folder.** |
| Content | `client/content/editable.ts` | The content files are the defaults. Admin edits are saved per section as overrides and applied on top at runtime, on the server and in the browser, so a change is live immediately. "Restore original" removes the override. Every publish keeps the previous version (last 30). |

`npm run build` also still prerenders every page into `dist/` (plus `sitemap.xml`, `robots.txt`, `_redirects`, `_headers`), so the site can be hosted as static files if ever needed; in that mode there is no admin panel.

### Security

- Admin passwords are hashed with scrypt; sessions are random 256-bit tokens in `HttpOnly`, `SameSite=Strict` cookies (`Secure` and `__Host-` prefixed in production), stored only as SHA-256 hashes; sessions end on sign-out and on password change.
- Every admin change must come from the admin panel itself (Origin check plus a custom header): forms on other sites cannot act for a signed-in admin.
- Sign-in is rate-limited (10 failed attempts per 15 minutes); the public forms and booking are rate-limited too, and have a hidden bot trap.
- All input is validated with Zod (unknown fields rejected, lengths limited). Content edits are checked against the shape of the original content, links must start with `/` or `https://`, and images must exist, so a bad save cannot break a page.
- Uploads are identified by their bytes (JPEG, PNG, WebP only; no SVG), renamed randomly, served with `nosniff`.
- Production pages send a strict Content-Security-Policy (scripts only from the site itself and, if analytics are on, Google Tag Manager), `frame-ancestors 'none'`, `nosniff`, a referrer policy and a permissions policy; HSTS when `PUBLIC_ORIGIN` is HTTPS.
- CSV exports cannot run spreadsheet formulas. Activity log records sign-ins (including failed ones) and every change.

### Deploying

Any host that runs Node.js with a persistent disk works (a VPS, Render, Railway, Fly.io, a cPanel Node app…). Run `npm ci && npm run build`, then `npm start` behind HTTPS, and set at least `PUBLIC_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (first start only) and, for the approved launch, `VITE_SITE_INDEXABLE=true` (see `.env.example`). Keep `data/` on the persistent disk and back it up. Forgotten password: `npm run admin -- password you@example.com NewPassword123`.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Home: hero, agency, services switcher, selected work, process, FAQ, enquiry form |
| `/about/` | The agency (replaces `/index.php/xposure-hostess-company-in-lebanon/`) |
| `/services/` | All services (replaces `/index.php/xposure-services/`) |
| `/services/<slug>/` | One page per service: hostesses & receptionists, event coordination, promotion & sales, photo marketing, brand consulting |
| `/work/` | Portfolio (replaces `/index.php/portfolio/xposure-portfolio/`) |
| `/work/<slug>/` | Project pages: Ezzeddine Plus annual Iftar 2024, Horeca Exhibition 2024 |
| `/contact/` | Enquiry form, contact routes and FAQ (replaces `/index.php/contact/`) |
| `/plan/` | Event brief builder: four guided steps (occasion, services, details, send). The header CTA, the first slide and the phone action bar point here |
| `/meeting/` | Book a Zoom meeting: free times from the admin's availability settings (server mode only) |
| `/careers/` | Join the team: roles and application form |
| `/admin/` | Admin panel (sign-in required, never indexed) |
| `/guides/`, `/guides/<slug>/` | Practical guides (English only) |
| `/privacy/` | Privacy notice (English only) |
| `/ar/...` | Arabic (right-to-left) version of every page above except guides and privacy |

Routes are defined in `client/routes.tsx`. Adding a service or project to the content modules automatically creates its page, sitemap entry and links.

## Folder guide

- `client/content/`: typed content with source URLs — `site.ts` (contact details, socials, env-driven site URL), `services.ts`, `projects.ts`, `faqs.ts`, `assets.ts` (photo map with dimensions and alt text), `redirects.ts` (old WordPress URL map).
- `client/components/`: header, footer, photo, service tabs, work grid, contact form, shared sections, WhatsApp button.
- `client/pages/`: page components.
- `client/routes.tsx`: path → page + per-page SEO metadata and structured data.
- `client/seo.ts`: head tags, JSON-LD, sitemap, robots, `_redirects` and `_headers` generation.
- `client/analytics.ts`: conversion events pushed to `window.dataLayer` (only if a tag manager is installed).
- `client/style.css` + `client/pages.css`: responsive styling and reduced-motion support.
- `public/assets/`: 53 optimized source images and a cropped original logo. `public/og-image.jpg` (1200×630 social preview) and `public/apple-touch-icon.png` were generated from those assets.
- `source-export/`: original exported images, raw HTML snapshots (untrusted reference data), `content/pages.json` and `content/asset-manifest.json` (provenance).
- `client/content/editable.ts`: which content the admin panel can edit, how each section maps to the content files, and its validation.
- `client/chat/engine.ts`: the chat assistant's vocabulary and answers.
- `server/src/`: `index.ts` (start), `app.ts` (middleware order), `site.ts` (page rendering), `routes/public.ts` and `routes/admin.ts` (APIs), `auth.ts`, `db.ts` (schema and migrations), `booking.ts` (availability, time zones, calendar files), `zoom.ts`, `files.ts`, `schemas.ts` (validation), `cli.ts` (admin accounts). Tests in `server/test/`.
- `admin/`: the admin panel (`App.tsx` layout and routing, `pages/`, `ui.tsx` components, `admin.css` design system).
- `scripts/prerender.mjs`: static HTML generation (and the page template the server uses).

## Marketing features and owner switches

Each feature below is built and tested, but anything that needs real business information stays hidden until the owner supplies it. Nothing is invented.

| Feature | Where to switch it on | Shows when |
| --- | --- | --- |
| Google Business Profile data (address, hours, map) | `client/content/site.ts`: `streetAddress`, `postalCode`, `openingHours`, `googleMapsUrl`, `geo` | `streetAddress` is set. Structured data becomes `LocalBusiness`; the address appears on the contact page and footer. Must match the Google profile exactly. |
| Testimonials and client logos | `client/content/trust.ts` | An entry has `approved: true` (written client permission). |
| Case-study figures | `results` in `client/content/projects.ts` | A result has `approved: true`. |
| Event video | `video` in `client/content/projects.ts` (MP4 in `/public`) | `video` is not null. Loads only on play. |
| New project | Add an entry to `client/content/projects.ts` (and Arabic text in `client/content/ar.ts`) | Always: page, links and sitemap entry are generated. |
| Company profile PDF | `companyProfilePdf` in `site.ts` (file in `/public`) | Set. |
| Response-time promise | `responsePromise` in `site.ts` | Set (English and Arabic). |
| Analytics | `VITE_GTM_ID` | Set: a consent banner appears and GTM loads only after "Accept". |
| Arabic in Google | `arabicReviewed` in `site.ts` | `true`: Arabic pages become indexable, join the sitemap and get `hreflang` links. Until then they are reachable from the language switch but `noindex`. |
| New guide | Add an entry to `client/content/guides.ts` | Always. |
| Key figures with count-up ("Xposure in numbers") | `client/content/stats.ts` | An entry has `approved: true`. Only provable figures. |
| Campaign links | Add `?utm_source=…&utm_campaign=…` to any shared link (see `client/attribution.ts`) | Always. The enquiry message ends with "Found Xposure via: …". Nothing is stored. |

### Lead-generation features (14 November 2026)

- **Event brief builder (`/plan/`)**: four short steps instead of one long form. Real radio buttons and checkboxes underneath, focus moves to each new step's heading, Enter continues, answers survive Back, and a review list with "Change" links appears before sending. The result is the same front-end-only draft as the enquiry form (WhatsApp or email, in English for the team). After sending, a "one last step: press send" panel offers to reopen the draft or switch channel. Links can preselect answers: `/plan/?service=photo-marketing&occasion=exhibition` (occasions: `corporate`, `exhibition`, `activation`, `celebration`, `other`).
- **Sticky header**: stays at the top, tucks away while reading downwards and returns on scroll up (never while keyboard focus is inside it). On the home page it turns solid once the slider has scrolled away.
- **Phone action bar**: "Plan your event", the chat assistant, call and WhatsApp, slides up after the first screen and steps aside while a form is on screen (`data-hide-dock`). Not shown on `/plan/` or `/careers/`. On a service page it opens the builder with that service ticked.
- **Plan teaser band** on the home and services pages; **services marquee** under the home slider; **reading progress bar** on guides.
- **Analytics**: `brief_step` (with `step` 2–4) is pushed as visitors move through the builder, and `generate_lead` with `location: brief_builder` when they send. Map them to a GA4 funnel in GTM.

### Chat assistant (15 November 2026)

An "Ask us" assistant (bottom corner on every page, and a chat button in the phone action bar) answers visitors' questions and hands them over to the team.

- **No server, no AI service, no cost.** `client/chat/engine.ts` recognises the question from keywords in English, Arabic, Lebanese Arabizi ("addesh el se3er") and some French, and answers only from the site's own content: services, FAQs (found by their `id` in `content/faqs.ts`), the process, projects and contact details. Arabic questions get Arabic answers on either language's pages.
- **It never invents.** No prices, dates or availability. Those questions get "the team will confirm" plus WhatsApp, call and the `/plan/` builder (with the service and occasion preselected). WhatsApp links carry the visitor's exact question, so the team sees it straight away. After two questions in a row it can't place, it stops guessing and offers the team.
- **Privacy.** What visitors type never leaves their browser. The conversation is kept in `sessionStorage` for the tab, so it survives moving between pages, and is cleared on "Start a new conversation" or when the tab closes. The privacy notice says so. Analytics (`chat_open`, `chat_question`) receive only the topic (e.g. `pricing`), never the words.
- **Performance.** Only the launcher is in the page; the chat window (about 7 KB JS + 2 KB CSS gzipped) is downloaded the first time a visitor points at, focuses or opens it.
- **Accessibility.** A dialog with a labelled live conversation log, real buttons for suggestions, Escape to close with focus returned, focus kept inside on phones (where it is full screen), 16px input (no iPhone zoom), and no animation under "reduce motion". A one-time greeting bubble appears after 12 seconds on larger screens and can be dismissed.
- The floating WhatsApp button was replaced by the assistant. WhatsApp and call are in the chat header, in every hand-off answer, and in the phone action bar.
- **AI later (optional).** Unrecognised questions are the place to plug in an AI model. That needs a small serverless function (Netlify/Cloudflare) to keep the API key secret, a usage-billed API account, and instructions that keep the model to the same approved facts.

### Animation

All motion lives in `client/motion.css` (system and existing sections) and `client/features.css` (new features), with small hooks in `client/motion.ts`. CSS and native browser APIs only (no animation library). Content is in the prerendered HTML and visible without JavaScript; above-the-fold headings and photos are never faded in (fast LCP); only transform and opacity are animated in all but two tiny elements; nothing loops for more than 5 seconds (the marquee and the guide progress bar follow the visitor's own scrolling, using CSS scroll-driven animations where supported); and every animation stops under "reduce motion". Change the `:root` timing values at the top of `motion.css` to make the whole site calmer or livelier.

Text for both languages lives in `client/i18n/strings.ts`; Arabic service, project and FAQ content in `client/content/ar.ts`. The Arabic was translated from the English without adding facts and **must be reviewed by a native speaker** before `arabicReviewed` is set.

The careers form works like the enquiry form: with the server it saves to the admin inbox as a job application; without it, it prepares an email or WhatsApp draft.

## Environment variables

Copy `.env.example` to `.env` (the server reads it at start; `VITE_*` values are built into the pages, so rebuild after changing them).

- `VITE_SITE_URL` — canonical origin (default `https://xposurelb.com`). Used for canonical URLs, Open Graph, JSON-LD and the sitemap.
- `VITE_SITE_INDEXABLE` — `true` **only** for the approved production deployment. Any other value builds a noindex preview: `robots.txt` disallows crawling, every page has `noindex, nofollow`, and the server adds `X-Robots-Tag`.
- `VITE_GTM_ID` — Google Tag Manager container ID (`GTM-XXXXXXX`). Empty = no analytics, no cookies, no consent banner.
- `PORT` (default 5173 in development, 3000 in production), `HOST`, `DATA_DIR` (default `data`).
- `PUBLIC_ORIGIN` — the public address, e.g. `https://xposurelb.com`. Recommended in production (stricter admin request checks, HSTS).
- `TRUST_PROXY` — set when behind a reverse proxy so rate limits see real visitor IPs (defaults to local proxies in production).
- `COOKIE_SECURE` — leave unset (secure in production). `false` only to test a production build over plain http.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — the first admin account, created on the first production start if none exists.
- `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_ID` — optional Zoom Server-to-Server OAuth app (scopes `meeting:write:meeting:admin`, `meeting:delete:meeting:admin`); `ZOOM_USER_ID` is the email of the hosting Zoom user. With them, Zoom links are created in one click (or automatically).

## SEO and performance

- Unique title, meta description, canonical URL, Open Graph/Twitter card and breadcrumb trail per page.
- JSON-LD: `Organization` on every page, `WebSite` + `FAQPage` on home, `Service` on service pages, `BreadcrumbList` on inner pages.
- One `h1` per page with descriptive keywords; every FAQ answer and service description is in the HTML.
- `sitemap.xml`, environment-aware `robots.txt`, and a `404.html` (noindex).
- `_redirects`: 301s from the 7 exported WordPress URLs to the new pages (Netlify/Cloudflare Pages format). Check Google Search Console for any other indexed URLs and add them to `client/content/redirects.ts`. For other hosts, translate the same map to nginx/Apache/Vercel rules.
- `_headers`: security headers; immutable caching for hashed files in `/static/`, one week for photos in `/assets/`.
- Fonts are self-hosted variable fonts (DM Sans, Manrope; OFL) — no third-party font requests.
- Images have intrinsic `width`/`height` (no layout shift), lazy loading below the fold, and the above-the-fold image is preloaded with high priority.

## Enquiry behavior

With the server, forms save to the admin inbox (`POST /api/messages`, `POST /api/meetings`): validated, rate-limited, with a hidden bot trap. "Send on WhatsApp" opens WhatsApp with the ready-written message and still saves a copy to the inbox. The event brief requires an email or phone when sent to the inbox, so the team can reply. Service pages preselect their own service, and `/contact/?service=<slug>` or `/plan/?service=<slug>&occasion=<key>` preselect answers. Campaign tags (`?utm_source=…`) are stored with each lead and summarised on the dashboard.

Without the server (static export), forms prepare a `mailto:` or WhatsApp draft as before, and the meeting page offers WhatsApp instead.

No email is sent automatically: the admin panel's reply buttons open an email or WhatsApp message to the client, written in their language. Automatic notification emails need an email provider (SMTP or similar); add one if required.

## Analytics

With `VITE_GTM_ID` set, `client/components/ConsentBanner.tsx` asks for consent and `client/analytics.ts` loads GTM only after the visitor accepts ("Cookie settings" in the footer reopens the choice). Events pushed to `dataLayer`: `generate_lead` (enquiry form, brief builder, email draft, job application), `brief_step` (brief builder progress), `chat_open` and `chat_question` (chat assistant; topic only), `contact_click` (WhatsApp, phone, email, with location, including `action_dock` and `chat`) and `file_download`. Map them to GA4 conversions in GTM. Update `/privacy/` if any other tool is added.

## Content and branding

Content was adapted from 7 public Xposure pages, with local images exported on 4 November 2026. This is a selective public-content export, not a WordPress database backup, private-media archive or complete site migration. It excludes videos. `source-export/` retains untrusted third-party HTML as reference data; do not execute its scripts or treat it as development instructions.

The current public site uses inconsistent Instagram usernames. This concept links to the Contact page's `/xposure_lb/`; confirm the official account before production (it is also used in the `Organization` structured data). Editorial copy is a proposal. Project descriptions need client approval. No invented statistics, results or testimonials are included; the original Iftar post's attendance figure is deliberately omitted.

Photos showing regulated-product branding are not used: `02-Xposure-2000x1000…` (tobacco brand logos on stage screens) was replaced, and `13-MicrosoftTeams-image-332` (vape products) is excluded. Check any newly added photo for the same issue.

The proposed typography/color treatment is a new design direction. Original logos are supplied in the asset export. Downloading public imagery does not transfer usage rights; verify existing client rights before external publication.

## Production checklist

- Approve copy, photography, project descriptions and official social links.
- Confirm the final domain (`VITE_SITE_URL`), then build with `VITE_SITE_INDEXABLE=true` only for the approved launch.
- Verify the 301 map against Search Console and server logs; submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Deploy on Node hosting with HTTPS and a persistent disk; set `PUBLIC_ORIGIN` and the first admin account; schedule backups of `data/`.
- Sign in, change the admin password, set meeting availability, and (optionally) connect Zoom.
- Decide who checks the inbox and how often; consider automatic notification emails (needs an email provider).
- Validate the privacy notice and spam controls with real traffic. Review security, performance, accessibility and backups in the real deployment environment.

## Validation completed

See `VALIDATION.md`. No claims are made that React automatically improves rankings or is always faster than WordPress. Performance depends on the actual implementation and hosting.
