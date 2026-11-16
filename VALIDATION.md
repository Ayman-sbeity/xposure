# Validation record

## 15 November 2026 — server, admin panel, Zoom booking, content management

Added: Node.js server (Express 5, SQLite built into Node, server-side rendering), admin panel at `/admin/` (dashboard, inbox, meetings and availability, content editor for 10 sections in English and Arabic with history, media library, activity log, settings), `/meeting/` booking pages, forms saving to the inbox, optional Zoom integration, admin command line. The MongoDB API was replaced.

Passed:
- Strict TypeScript for the site, the admin and the server; production build: 34 prerendered pages + `404.html`; `npm audit --omit=dev`: 0 vulnerabilities.
- `npm test`: 20 server tests: Beirut winter/summer time; slots respect weekly hours, minimum notice, days off, and the buffer around existing bookings; calendar files folded to 75 bytes; images recognised by their bytes (SVG refused); CSV formula injection neutralised; valid enquiry saved; invalid input and unknown fields rejected; bot trap stores nothing; a time cannot be booked twice; admin API needs a session; cross-site sign-in blocked; wrong password refused; session cookie `HttpOnly` + `SameSite=Strict`; unsafe content (a `javascript:` link) refused; published content live on the page and reset; security headers, redirects and 404; sign-out ends the session.
- Headless Edge against the **production build** with a fresh database and the production Content-Security-Policy (98 checks): all 35 public pages at 1440 and 390 px with no console or hydration errors, overflow or broken images; the earlier marketing-feature, planner, header, slider and phone-bar checks; all 36 chat checks; and 27 admin/site checks: contact form and event brief saved to the inbox (brief asks for an email or phone), meeting booked in English, Arabic page in Arabic, chat links "book a zoom call" to booking; admin sign-in (wrong password refused), unread badge, inbox details with campaign, note, archive and undo, search; meeting link saved, confirmed and confirmation message prepared; 10 content sections; unsaved-changes bar; Ctrl+S publishes and the live page changes; history restore; wording search; activity log; admin on a phone without overflow.
- Generated-HTML audit: all 35 public pages pass (one `h1`, title and description lengths, JSON-LD, image sizes, no broken links). The admin app shell is not a public page (noindex).
- Development data created by these tests was removed from `data/xposure.db`.

Limitations:
- Zoom: the integration follows Zoom’s Server-to-Server OAuth and Meetings API but was not run against a real Zoom account (no credentials). Pasting a link works without Zoom.
- No automatic emails are sent (no email provider configured): replies and confirmations open in the admin’s email app or WhatsApp.
- New Arabic text needs native-speaker review. Not tested on real phones, Safari/iOS, or the final hosting provider. Single-server design: SQLite suits one server instance (ample for this site); a multi-server setup would need a shared database.

## 15 November 2026 — chat assistant

Added: "Ask us" assistant (`client/chat/engine.ts`, `ChatWidget.tsx`, lazily loaded `ChatPanel.tsx` + `chat.css`), chat button in the phone action bar, privacy-notice section. Removed the floating WhatsApp button (replaced by the assistant). Fixed the home page preloading an image the slider never shows; it now preloads the first slide.

Passed:
- Strict TypeScript and production build (32 pages + `404.html`); generated-HTML audit of all 33 files with 0 problems. The chat window is a separate chunk (about 7 KB JS + 2 KB CSS gzipped) and is not requested on page load.
- Engine: 56 phrasings in English, Arabic, Lebanese Arabizi and French routed to the right topic, plus checks that Arabic questions get Arabic answers on the English site, WhatsApp hand-offs carry the visitor's exact question, planner links preselect service and occasion, a second unrecognised question hands over to the team, and no price figure appears in any answer.
- Headless Edge, 36 checks: launcher, welcome and chips, typing indicator, chip and typed answers, WhatsApp pre-fill, call/email hand-off, fallback then hand-over, Escape closes and returns focus, conversation kept across pages, "Start a new conversation", greeting bubble timing and dismissal (once per visit), Arabic answers, phone full-screen modal from the action bar with no overflow, scroll restored on close, reduced motion, no console or hydration errors.
- The 35 earlier browser checks (brief builder, header, slider, action bar, Arabic, reduced motion) still pass. Arabic phone numbers in the chat render left to right.

Limitations:
- The assistant matches keywords; it does not understand free text like an AI model. Questions outside its vocabulary get a polite fallback and a WhatsApp hand-off. The phrasing tests were written by the developer, so watch real `chat_question` topics (especially `fallback`) and add words in `engine.ts`.
- The new Arabic wording needs native-speaker review. Not tested on real phones or Safari/iOS.

## 14 November 2026 — lead-generation features and animation system

Added: `/plan/` brief builder (English and Arabic), sticky header, phone action bar, plan teaser band, scroll-linked services marquee, owner-gated key figures with count-up, campaign (utm) attribution in enquiry messages, guide reading progress, and a site-wide animation system (`client/motion.css`, `client/motion.ts`). No new runtime dependencies.

Passed:
- Strict TypeScript and production build: 32 prerendered pages + `404.html` (adds `/plan/` and `/ar/plan/`). Bundle grew by about 8 KB of JS and 4 KB of CSS (gzipped).
- Generated-HTML audit of all 33 files: one `h1`, titles ≤ 60 characters, descriptions 110–160 characters, valid JSON-LD, `alt` and size on every image, no duplicate ids, no broken internal links.
- Headless Edge (Chromium), all 33 pages at 1440 and 390 px (66 loads): no console or hydration errors, no horizontal overflow, no broken images.
- Reveal animations: on 14 representative pages at both widths with mouse-wheel scrolling, every animated element ends visible, including ones skipped by a fast scroll once they are brought on screen.
- Brief builder: an error appears (and the step does not advance) without an occasion; cards check real radios; focus moves to each step heading; `?service=photo-marketing` preselects; Enter continues; Back keeps answers; review list correct; "Send on WhatsApp" opens `wa.me/96176853602` with occasion, services, details, phone and `Found Xposure via: instagram / test-campaign`; the done panel appears.
- Header: home overlay becomes solid and fixed after scrolling, hides on scroll down, returns on scroll up. Slider advances after 6 s (progress-bar timing) and the pause button stops it.
- Phone action bar: hidden on the first screen, slides up after scrolling, hides over the contact form, absent on `/plan/`, links to `/plan/?service=<slug>` on service pages; the floating WhatsApp button steps aside while it is up.
- Arabic `/ar/plan/` is RTL with mirrored step transitions and no horizontal overflow.
- Reduced motion (emulated): reveal system off, slider does not auto-advance, no Ken Burns zoom.

Limitations:
- The new Arabic text (brief builder, teaser, action bar) needs native-speaker review like the rest of the Arabic.
- Scroll-driven animations (marquee movement, guide progress bar, teaser asterisk) only run in browsers that support them (Chromium, recent Safari); elsewhere they are static. The smooth FAQ height animation needs Chromium 131+; other browsers open it instantly with a fade.
- Not tested on real phones or Safari/iOS. No figures have been added to `stats.ts`, so the key-figures band is built but hidden.

## 10 November 2026 — front-end only + new visual design

Passed:
- Strict TypeScript and production build: 30 prerendered pages + `404.html`; 0 `npm audit` findings. The client no longer contains any API call.
- Headless Edge, all 31 pages at 1440/768/390/360 px (124 loads): no console or hydration errors, no horizontal overflow, no broken images. Home (English and Arabic), a service page and the contact form reviewed in screenshots at desktop and phone size.
- Slider: next button changes slide, pause stops auto-advance (checked over 7 s), only the visible slide's button is keyboard-focusable, one `h1` on the page.
- Forms: "Send on WhatsApp" opens a `wa.me` link to the Xposure number with the typed details; the status message appears. "Send by email" uses the same message in a `mailto:` draft.

Limitations:
- Real phones and Safari not tested. Arabic still needs native-speaker review.
- Because the site has no server, an enquiry only reaches Xposure if the visitor presses send in their email app or WhatsApp.

## 10 November 2026 — marketing additions and Arabic

Passed:
- Build: 30 prerendered pages (17 English, 13 Arabic) + `404.html`. Strict TypeScript, 0 `npm audit` findings in both packages.
- Generated-HTML audit of all pages: one `h1`, one `<title>`, valid JSON-LD, `alt` and dimensions on every image, no broken internal links or duplicate ids. Arabic pages ship `<html lang="ar" dir="rtl">`.
- Headless Edge, all 31 pages at 1440/768/390/360 px (124 loads): no console or hydration errors, no horizontal overflow, no broken images. Arabic home, service, contact and the careers and guide pages reviewed in screenshots.
- Every owner switch was turned on in a temporary build, checked, then restored: `LocalBusiness` data with address/hours/map, contact-page address, response promise, company-profile link, testimonial (English quote marked `lang="en"` on the Arabic page), approved case-study figure.
- Consent: with a test GTM ID the banner appears; no Google script before a choice or after Decline; the footer link reopens it; the script loads only after Accept. Without an ID there is no banner and no GTM code path runs.
- Arabic review gate: with indexing on and `arabicReviewed: false`, Arabic pages are `noindex`, absent from the sitemap, have no `hreflang`, and `_headers` adds `X-Robots-Tag` for `/ar/*`.
- API: 6 validation tests pass, including the new job-application schema.

Limitations:
- Arabic text has not been reviewed by a native speaker.
- The privacy notice has not had legal review. The Google Business Profile itself, directory listings and backlinks are off-site tasks.
- `/api/applications` was not run against a database (none provisioned). Real phones and Safari were not tested.

## 10 November 2026 — multi-page SEO build

Passed:
- Frontend strict TypeScript check and Vite production build; 12 pages + `404.html` prerendered with route-specific `<head>`.
- Generated-HTML audit (all pages): exactly one `h1`, one `<title>`, titles ≤ 60 characters, descriptions 110–160 characters, canonical URL on indexable pages, JSON-LD parses, every `<img>` has `alt` and `width`/`height`, no broken internal links or image paths, no duplicate `id`s.
- Headless Microsoft Edge (Chromium) against `vite preview`, every page at 1440, 768, 390 and 360 px: no console errors or warnings (including React hydration), no horizontal overflow, no broken images. Screenshots reviewed at 1440 and 390 px.
- Interactions: services tab list keyboard navigation (Arrow keys, Home/End, wrap-around); `/contact/?service=photo-marketing` and service-page forms preselect the right service; all FAQ answers present in HTML via `<details>`.
- Production indexing switch: with `VITE_SITE_INDEXABLE=true`, `robots.txt` allows crawling and lists the sitemap, pages are `index, follow`, `404.html` stays `noindex`, no `X-Robots-Tag`. The default build is noindex.
- API: `tsc --noEmit`, build, and 4 validation tests (trimming, invalid email/oversized message, optional phone format, unexpected operator fields and honeypot). `npm audit`: 0 vulnerabilities in both packages after upgrading Zod 3.25 → 4.6.7 (GHSA-mrhx-c7xc-m3w5).

Limitations:
- No MongoDB instance was provisioned; persistence and end-to-end API delivery have not been tested. The preview uses mailto drafts and no enquiry was sent.
- Responsive checks used Chromium device emulation, not real phones or Safari/iOS.
- `_redirects` and `_headers` use Netlify/Cloudflare Pages syntax and were not tested on a live host.
- No Lighthouse/Core Web Vitals measurement on the production host, complete WCAG audit with assistive technology, or penetration test is claimed.
- No WordPress private content, database, videos or hidden media were exported.

## 4 November 2026 — initial single-page preview

Passed: strict TypeScript and Vite build; build-time rendering of the main page; Express/TypeScript compilation; three validation tests; browser checks of anchor navigation, service selection, portfolio filtering, project dialog, FAQ expansion, one H1, no broken images and no horizontal overflow at the tested desktop viewport; 53 image downloads.
