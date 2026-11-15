# How to edit the Xposure website yourself

The site is front-end only: there is no server and no database. Everything you see comes from a few plain files. Run `npm run dev`, open http://localhost:5173, and the page refreshes each time you save a file.

## Where things live

| I want to change… | Open this file |
| --- | --- |
| Home slider photos, captions and buttons | `client/content/home.ts` |
| Colours of the round service photos | `client/content/home.ts` (`circleTints`) |
| Site colours, button shape, font | `client/theme.css` (the `:root` block at the top) |
| Phone, email, WhatsApp, Instagram, address | `client/content/site.ts` |
| Services (names, text, photo) | `client/content/services.ts` (Arabic: `client/content/ar.ts`) |
| Projects | `client/content/projects.ts` (Arabic: `client/content/ar.ts`) |
| Questions and answers | `client/content/faqs.ts` |
| Testimonials and client logos | `client/content/trust.ts` |
| Key figures ("Xposure in numbers") | `client/content/stats.ts` |
| Wording of the "Plan your event" builder | `client/i18n/strings.ts` (the `plan` block) |
| Animation speed | `client/motion.css` (the `:root` block at the top) |
| What the chat assistant says | `client/i18n/strings.ts` (the `chat` block) |
| Words the chat assistant understands | `client/chat/engine.ts` (the lists at the top) |
| Guides | `client/content/guides.ts` |
| Any other wording (menus, headings, buttons) | `client/i18n/strings.ts` (English first, Arabic second) |

## Add a new photo

1. Save the photo in `public/assets/`. Use `.webp` or `.jpg`, about 1600 px wide and under 300 KB.
2. Open `client/content/assets.ts` and add an entry. Copy an existing one and change it:

   ```ts
   myNewPhoto: {
     file: 'my-new-photo.webp',
     width: 1600,
     height: 900,
     alt: 'What the photo shows, in English',
     altAr: 'وصف الصورة بالعربية',
   },
   ```

   `width` and `height` are the photo's real size in pixels. `alt` is read aloud to blind visitors and read by Google, so describe the photo.
3. Use the name (`myNewPhoto`) anywhere a photo is asked for.

Do not use photos that show tobacco or vape products or brands, and only use photos you have the right to publish.

## Change the home slider

In `client/content/home.ts`, each block between `{` and `}` in `slides` is one slide:

```ts
{
  image: 'team',                                   // photo name from assets.ts
  caption: { en: 'Great events. Even better people.', ar: '…' },
  label: { en: 'Xposure', ar: 'Xposure' },         // small line above the caption
  button: { en: 'Plan your event', ar: '…' },
  link: '/contact/',                               // where the button goes
},
```

Copy a block to add a slide, delete one to remove it, or move blocks to reorder. Wide photos work best. `SLIDE_SECONDS` sets how long each slide stays.

## Change colours and style

At the top of `client/theme.css`:

```css
--ink: #111111;    /* text and black buttons */
--paper: #ffffff;  /* page background */
--pink: #c2188f;   /* accent colour */
--radius: 999px;   /* 999px = pill buttons, 4px = square buttons */
```

Change a value, save, and the whole site follows.

## Add a project

Copy one of the two entries in `client/content/projects.ts`, give it a new `slug` (the web address, lowercase with dashes) and fill in the text and photos. Its page, its card in "Our Work" and its sitemap entry appear automatically. Add the Arabic text under the same `slug` in `client/content/ar.ts`.

## Share the "Plan your event" link

`/plan/` walks a visitor through four quick steps and prepares their brief for WhatsApp or email. Use it as the link in your Instagram bio, ads, WhatsApp status and email signature.

Add tags to the end of the link to see where each enquiry came from. The message the visitor sends will end with a line such as `Found Xposure via: instagram / ramadan-2027`:

```
https://xposurelb.com/plan/?utm_source=instagram&utm_campaign=ramadan-2027
https://xposurelb.com/plan/?utm_source=facebook-ad&utm_campaign=exhibitions
https://xposurelb.com/plan/?utm_source=whatsapp-status
```

You can also tick an answer in advance, for example for a post about photo booths at exhibitions:

```
https://xposurelb.com/plan/?service=photo-marketing&occasion=exhibition&utm_source=instagram
```

Service names are the web addresses of the service pages (`hostesses-and-receptionists`, `event-coordination`, `promotion-and-sales`, `photo-marketing`, `brand-consulting`). Occasions are `corporate`, `exhibition`, `activation`, `celebration` or `other`.

## Show key figures

Numbers such as events staffed or hostesses on the team make a strong impression, but only publish figures you can prove. In `client/content/stats.ts`, add an entry (an example is written there) and set `approved: true`. A "Xposure in numbers" band then appears on the home page under "Our story", and each number counts up as visitors scroll to it.

## The chat assistant ("Ask us")

The assistant answers from the website's own content, so when you edit a service, an FAQ or your phone number, its answers update too. It never quotes prices or confirms dates: for those it sends the visitor to WhatsApp or a call, with their question already typed into the WhatsApp message.

- **Change its wording:** edit the `chat` block in `client/i18n/strings.ts` (English first, Arabic second). Keep every sentence true.
- **Teach it a word it missed:** open `client/chat/engine.ts` and add the word to the right list near the top, for example add `'gig'` to the `careers` list, or `'كوكتيل'` to `celebration`. A plain word also matches longer words that start with it (`price` matches `prices`). Put `=` in front for an exact match only (`'=hi'`). Arabic words match anywhere inside a word.
- **See what people ask:** with analytics switched on, the `chat_question` event tells you each question's topic (pricing, availability, a service…). The words people type are never recorded.

## Animations

Sections glide in as visitors scroll, the home slider slowly zooms and shows a progress bar, and buttons react on hover. To make everything calmer or livelier, change the values at the top of `client/motion.css` (for example `--dur: 0.7s;` to `1s;` for slower entrances). Visitors whose phone or computer is set to "reduce motion" see no animation.

## Rules worth keeping

- Only publish facts you can prove: no invented clients, numbers, awards or quotes.
- Testimonials, logos and project figures show only when marked `approved: true`. Mark them only after the client agrees in writing.
- After editing, run `npm run build`. If it prints an error, the message names the file and line to fix.

## Put the site online

`npm run build` creates the finished site in the `dist` folder. Upload that folder to any static host (Netlify, Cloudflare Pages, or ordinary web hosting). For the real launch only, build with `VITE_SITE_INDEXABLE=true` so Google can list the site.
