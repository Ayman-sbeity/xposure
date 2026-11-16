// CHAT ASSISTANT ENGINE. Runs entirely in the visitor's browser: no server, no AI service,
// nothing typed is sent anywhere.
//
// It recognises what a visitor is asking about from keywords (English, Arabic, Lebanese
// Arabizi and some French) and answers ONLY from the website's own approved content:
// services (content/services.ts), FAQs (content/faqs.ts), the process and projects, and the
// contact details in content/site.ts. It never states prices, dates or availability; for
// those it hands over to the team on WhatsApp or by phone, with the visitor's question
// already written into the WhatsApp message.
//
// TEACH IT A NEW WORD: add it to the right list in TOPICS, SERVICE_WORDS or OCCASION_WORDS.
//   'word'      matches words that start with it (price -> prices, pricing)
//   '=word'     matches that exact word only (for short words such as '=hi')
//   'two words' matches the phrase
//   Arabic words match anywhere inside a word (so ال / و / ب prefixes still match).
// The assistant's wording is in client/i18n/strings.ts (the `chat` block).

import { getFaqs, type FaqId } from '../content/faqs';
import { getProjects } from '../content/projects';
import { getServices } from '../content/services';
import { site, whatsappLink } from '../content/site';
import { localizePath, stringsFor, type Locale } from '../i18n';
import { runtime } from '../runtime';

export type Topic =
  | 'welcome'
  | 'greeting'
  | 'meeting'
  | 'services'
  | 'service'
  | 'pricing'
  | 'contact'
  | 'location'
  | 'hours'
  | 'availability'
  | 'start'
  | 'combine'
  | 'brief'
  | 'teamSize'
  | 'requirements'
  | 'process'
  | 'work'
  | 'about'
  | 'careers'
  | 'occasion'
  | 'thanks'
  | 'fallback';

export type Occasion = 'corporate' | 'exhibition' | 'activation' | 'celebration';
export type ChatLink = { label: string; href: string; kind: 'page' | 'whatsapp' | 'call' | 'email' | 'external' };
/** A suggestion chip. Tapping it asks the question without typing. */
export type Quick = { label: string; topic: Topic; slug?: string };
export type BotReply = {
  from: 'bot';
  lang: Locale;
  topic: Topic;
  text: string[];
  list?: string[];
  links?: ChatLink[];
  quick?: Quick[];
};

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
type Rule = { topic: Topic; strong?: string[]; words?: string[]; weak?: string[] };

// Order matters only for ties: earlier topics win.
const TOPICS: Rule[] = [
  {
    topic: 'meeting',
    strong: ['zoom', 'video call', 'video meeting', 'online meeting', 'book a meeting', 'schedule a meeting', 'a meeting with', 'meet with you', 'meet you', 'meet the team', 'schedule a call', 'book a call', 'appointment', 'اجتماع معكم', 'اجتماع مع', 'زوم', 'موعد', 'مكالمه فيديو', 'rendez vous'],
    words: ['meeting', 'اجتماع', 'reunion'],
  },
  {
    topic: 'contact',
    strong: ['whatsapp', 'whats app', 'watsap', '=wts', 'call', 'phone', 'telephone', 'واتس', 'وتساب', 'اتصل', 'اتصال', 'هاتف', 'تلفون', 'تليفون', 'appel'],
    words: ['=number', 'mobile', 'contact', 'talk to', 'speak to', 'speak with', 'talk with', 'human', 'real person', 'agent', 'someone', 'representative', 'email', 'e mail', '=mail', 'reach you', 'رقم', 'موبايل', 'تواصل', 'ايميل', 'بريد', 'احكي مع', 'اكلم', 'ra2m', 'ra2am', 'raqam', 'numero', 'contacter'],
  },
  {
    topic: 'pricing',
    strong: ['price', 'pricing', '=cost', '=costs', 'costing', 'how much', 'budget', 'quote', 'quotation', '=rate', '=rates', '=fee', '=fees', 'سعر', 'اسعار', 'كلفه', 'تكلفه', 'تكاليف', 'بكم', 'ميزانيه', 'تسعير', 'se3r', 'sa3r', 'se3er', 'sa3er', 'as3ar', '=adde', '=addesh', '=adesh', '=2ade', '=2adde', '=2adesh', '=adei', 'prix', 'tarif', 'combien', '=cout', 'devis'],
    words: ['charge', 'expensive', 'cheap', 'afford', '=pay', 'payment', 'كم يكلف', 'غالي', 'رخيص'],
  },
  {
    topic: 'careers',
    strong: ['=job', '=jobs', 'career', 'hiring', 'vacanc', 'apply', '=cv', 'resume', 'join your team', 'join the team', 'work for you', 'work with you as', 'become a hostess', 'become a promoter', 'وظيف', 'توظيف', '=شغل', 'سيره ذاتيه', 'انضم', 'قدم طلب', '=shoghl', 'wazife', 'emploi', 'travail'],
  },
  {
    topic: 'availability',
    strong: ['availability', 'are you available', 'are you free', 'still available', 'متاحين', 'متوفرين', 'فاضيين', 'disponib'],
    words: ['available', 'tomorrow', 'tonight', 'this weekend', 'next week', 'next month', 'urgent', '=asap', 'last minute', 'short notice', 'same day', 'fully booked', 'بكرا', 'بكره', 'غدا', 'مستعجل', 'عاجل', 'متاح', 'متوفر'],
  },
  {
    topic: 'teamSize',
    strong: ['how many', 'number of', 'team size', 'كم مضيف', 'كم شخص', 'كم واحد', 'عدد', 'kam wa7de', 'combien de'],
  },
  {
    topic: 'requirements',
    strong: ['language', 'english', 'french', 'arabic', 'speak', 'uniform', 'dress', 'outfit', '=wear', 'wearing', 'لغه', 'لغات', 'انكليزي', 'انجليزي', 'فرنسي', 'لباس', 'ملابس', '=زي', 'يلبس', 'langue', 'francais', 'anglais', 'tenue'],
    words: ['training', 'trained', 'appearance', 'تدريب', 'مظهر'],
  },
  {
    topic: 'combine',
    strong: ['combine', 'several services', 'multiple services', 'more than one', 'bundle', 'package', 'عده خدمات', 'اكثر من خدمه', 'دمج', 'باقه'],
    words: ['=both', 'together', 'several', 'multiple', 'مع بعض'],
  },
  {
    topic: 'brief',
    strong: ['what should i include', 'what to include', 'what information', 'what details', 'what do you need', 'what should i send', 'ماذا ارسل', 'شو لازم ابعت', 'شو بدكن', 'ما المعلومات', 'ما التفاصيل'],
    words: ['include', '=brief', 'information', 'details', 'معلومات', 'تفاصيل'],
  },
  {
    topic: 'start',
    strong: ['=book', 'booking', '=hire', 'reserve', 'get started', 'plan my event', 'plan an event', 'plan my', 'how do i start', 'how to start', 'how do we start', 'احجز', 'حجز', 'خطط', 'ابدا', 'نبدا', 'reserv'],
    words: ['start', 'enquir', 'inquir', 'request', 'proposal', 'order', 'اطلب', 'طلب'],
  },
  {
    topic: 'process',
    strong: ['how do you work', 'how does it work', 'how it works', 'your process', 'the process', 'what are the steps', 'كيف تعملون', 'كيف تشتغلو', 'كيف بتشتغلو', 'خطوات', 'مراحل', 'اليه العمل'],
    words: ['process', '=steps', 'step by step', 'workflow', 'procedure'],
  },
  {
    topic: 'hours',
    strong: ['opening hours', 'working hours', 'office hours', 'what time', 'when are you open', 'دوام', 'ساعات العمل', 'ساعات الدوام', 'horaires'],
    words: ['=hours', '=open', 'ساعات'],
  },
  {
    topic: 'location',
    strong: ['where are you', 'where is xposure', 'located', 'location', 'address', '=based', 'your office', 'وين', '=اين', 'اين مقر', 'اين انتم', '=مكان', 'المكان', 'مكانكم', 'عنوان', 'مقر', '=wen', '=wein', '=ween', 'adresse', 'ou etes'],
    words: ['outside', '=cover', 'travel', 'come to', 'خارج'],
    weak: ['beirut', 'lebanon', 'tripoli', 'jounieh', 'byblos', 'jbeil', 'saida', 'sidon', 'tyre', 'zahle', 'batroun', 'baalbek', 'metn', 'kesrouan', 'بيروت', 'لبنان', 'طرابلس', 'جونيه', 'جبيل', 'صيدا', 'زحله', 'البترون', 'بعلبك', 'المتن', 'كسروان'],
  },
  {
    topic: 'work',
    strong: ['portfolio', 'previous work', 'past events', 'your work', 'examples', 'projects', 'iftar', 'horeca', 'case stud', 'اعمالكم', 'مشاريع', 'افطار', 'هوريكا'],
    words: ['project', 'example', 'experience', 'clients', '=client', 'references', 'worked with', 'اعمال', 'مشروع', 'خبره', 'عملاء', 'زبائن'],
  },
  {
    topic: 'services',
    words: ['service', 'offer', 'provide', 'what do you do', 'what can you do', 'what you do', 'help me with', 'do you do', '=staff', 'staffing', 'خدمات', 'خدمه', 'تقدمون', 'شو بتعملو', 'شو بتقدمو', 'ماذا تقدم', 'فريق', 'btaamlo', 'prestation'],
  },
  {
    topic: 'about',
    strong: ['who are you', 'about you', 'about xposure', 'what is xposure', 'tell me about xposure', 'من انتم', 'مين انتو', 'مين انتم', 'عنكم'],
    weak: ['agency', 'company', 'xposure', 'الوكاله', 'الشركه'],
  },
  {
    topic: 'thanks',
    words: ['thank', '=thx', '=ty', 'merci', 'shukran', 'shokran', '=mersi', '=bye', 'goodbye', 'see you', '=ok', '=okay', '=great', '=cool', '=perfect', 'شكرا', 'يسلمو', 'تسلم', 'ممنون', 'مع السلامه', 'تمام'],
  },
  {
    topic: 'greeting',
    words: ['=hi', '=hii', '=hey', '=hello', '=hola', 'good morning', 'good afternoon', 'good evening', '=bonjour', '=bonsoir', '=salut', 'marhaba', 'mar7aba', '=kifak', '=kifik', '=ahla', '=ahlan', 'مرحبا', 'اهلا', 'السلام عليكم', '=هلا', 'صباح الخير', 'مساء الخير', 'كيفك', 'كيف حالك'],
  },
];

/** Words that point at one service, by the service's slug. */
const SERVICE_WORDS: Record<string, string[]> = {
  'hostesses-and-receptionists': ['hostess', '=host', '=hosts', 'hosting', 'receptionist', 'reception', 'usher', 'greeter', 'welcome staff', 'مضيف', 'استقبال', 'hotesse', 'hostesset'],
  'event-coordination': ['coordinat', 'organiz', 'organis', 'event manag', 'event planner', 'on site', 'onsite', 'logistic', 'تنسيق', 'تنظيم', 'منسق', 'منظم'],
  'promotion-and-sales': ['promot', '=sales', '=sell', 'selling', 'sampling', 'brand ambassador', 'ambassador', 'مروج', 'ترويج', 'مبيعات', '=بيع', 'promoteur', '=vente'],
  'photo-marketing': ['photo', 'booth', 'picture', 'camera', 'selfie', 'تصوير', '=صور', 'الصور', 'كاميرا', 'فوتو', 'سيلفي'],
  'brand-consulting': ['consult', 'brand strateg', 'branding', 'strategy', 'brand presence', 'استشار', 'علامه تجاريه', 'conseil'],
};

const OCCASION_WORDS: Record<Occasion, string[]> = {
  corporate: ['conference', 'corporate', 'company event', '=gala', 'dinner', 'seminar', 'forum', 'summit', 'award', 'ceremony', 'meeting', 'congres', 'موتمر', 'عشاء', 'ندوه', 'اجتماع', 'حفل الشركه'],
  exhibition: ['exhibition', '=expo', 'trade show', 'tradeshow', '=fair', '=stand', 'معرض', 'جناح', '=salon'],
  activation: ['launch', 'activation', 'campaign', 'roadshow', 'in store', '=mall', 'supermarket', 'opening', 'اطلاق', 'حمله', 'تفعيل', 'افتتاح'],
  celebration: ['wedding', 'birthday', 'engagement', 'party', 'graduation', 'anniversary', 'private event', 'baptism', 'عرس', 'زفاف', 'خطوبه', 'عيد ميلاد', 'حفله', 'تخرج', 'مناسبه خاصه', 'mariage', 'anniversaire'],
};

// Topics that are a clear request in their own right (they win over a service name).
const SPECIFIC = new Set<Topic>(['meeting', 'pricing', 'contact', 'availability', 'careers', 'teamSize', 'requirements', 'combine', 'brief', 'start', 'process', 'hours', 'location', 'work']);

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------
const ARABIC = /[؀-ۿ]/;

/** Lower case, no accents or Arabic diacritics, one spelling per Arabic letter, no punctuation. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const prep = (keyword: string) => (keyword.startsWith('=') ? `=${normalize(keyword.slice(1))}` : normalize(keyword));

function hit(text: string, tokens: string[], keyword: string): boolean {
  if (keyword.startsWith('=')) return tokens.includes(keyword.slice(1));
  if (keyword.includes(' ')) return ` ${text}`.includes(` ${keyword}`);
  if (ARABIC.test(keyword)) return text.includes(keyword);
  return tokens.some((token) => token.startsWith(keyword));
}

type Prepared = { topic: Topic; lists: [string[], number][] };
const PREPARED: Prepared[] = TOPICS.map((rule) => ({
  topic: rule.topic,
  lists: [
    [(rule.strong ?? []).map(prep), 2],
    [(rule.words ?? []).map(prep), 1],
    [(rule.weak ?? []).map(prep), 0.5],
  ],
}));
const SERVICES_PREPARED = Object.entries(SERVICE_WORDS).map(([slug, words]) => [slug, words.map(prep)] as const);
const OCCASIONS_PREPARED = (Object.entries(OCCASION_WORDS) as [Occasion, string[]][]).map(([key, words]) => [key, words.map(prep)] as const);

export type Detection = { topic: Topic; score: number; services: string[]; occasion: Occasion | null };

/** What a question is about. Exported for tests. */
export function detect(question: string): Detection {
  const text = normalize(question);
  const tokens = text.split(' ');
  let best: { topic: Topic; score: number } | null = null;
  for (const rule of PREPARED) {
    let score = 0;
    for (const [words, weight] of rule.lists) for (const word of words) if (hit(text, tokens, word)) score += weight;
    if (score > 0 && (!best || score > best.score)) best = { topic: rule.topic, score };
  }
  const services = SERVICES_PREPARED.filter(([, words]) => words.some((w) => hit(text, tokens, w))).map(([slug]) => slug);
  const occasion = OCCASIONS_PREPARED.find(([, words]) => words.some((w) => hit(text, tokens, w)))?.[0] ?? null;

  // "Hostesses for a company meeting" is about hostesses: the word "meeting" alone is weak.
  const weakMeeting = best?.topic === 'meeting' && best.score < 2 && (services.length > 0 || occasion !== null);
  if (best && SPECIFIC.has(best.topic) && best.score >= 1 && !weakMeeting) return { ...best, services, occasion };
  if (services.length === 1) return { topic: 'service', score: 1, services, occasion };
  if (services.length > 1) return { topic: 'combine', score: 1, services, occasion };
  if (occasion) return { topic: 'occasion', score: 1, services, occasion };
  if (best) return { ...best, services, occasion };
  return { topic: 'fallback', score: 0, services, occasion };
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------
type Ctx = { lang: Locale; question?: string; services: string[]; occasion: Occasion | null };

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
const joiner = (lang: Locale) => (lang === 'ar' ? '، ' : ', ');

function faq(lang: Locale, id: FaqId): string | undefined {
  return getFaqs(lang).find((item) => item.id === id)?.a;
}

function service(lang: Locale, slug: string) {
  return getServices(lang).find((s) => s.slug === slug);
}

// Links
const page = (lang: Locale, label: string, path: string): ChatLink => ({ label, href: localizePath(lang, path), kind: 'page' });

function whatsapp(lang: Locale, question?: string): ChatLink {
  const c = stringsFor(lang).chat;
  const message = question ? `${c.waIntro}\n\n${question}` : stringsFor(lang).common.whatsappMessage;
  return { label: c.links.whatsapp, href: whatsappLink(message), kind: 'whatsapp' };
}
// Phone numbers and emails always read left to right, even inside Arabic text
// (Unicode "left-to-right isolate"), otherwise +961 76 853 602 shows as 602 853 76 961+.
const ltr = (text: string) => `⁦${text}⁩`;
const call = (lang: Locale): ChatLink => ({
  label: fill(stringsFor(lang).chat.links.call, { phone: ltr(site.phoneDisplay) }),
  href: `tel:${site.phone}`,
  kind: 'call',
});
const email = (lang: Locale): ChatLink => ({
  label: fill(stringsFor(lang).chat.links.email, { email: ltr(site.email) }),
  href: `mailto:${site.email}`,
  kind: 'email',
});
function plan(lang: Locale, ctx?: Pick<Ctx, 'services' | 'occasion'>): ChatLink {
  const params = new URLSearchParams();
  if (ctx?.services.length === 1) params.set('service', ctx.services[0]);
  if (ctx?.occasion) params.set('occasion', ctx.occasion);
  const query = params.toString();
  return page(lang, stringsFor(lang).chat.links.plan, `/plan/${query ? `?${query}` : ''}`);
}

// Suggestion chips
function quick(lang: Locale, ...keys: (keyof ReturnType<typeof stringsFor>['chat']['quick'])[]): Quick[] {
  const q = stringsFor(lang).chat.quick;
  const topics: Record<string, Topic> = {
    services: 'services',
    meeting: 'meeting',
    price: 'pricing',
    plan: 'start',
    team: 'contact',
    work: 'work',
    location: 'location',
    process: 'process',
    other: 'services',
  };
  return keys.map((key) => ({ label: q[key], topic: topics[key] }));
}

function compose(topic: Topic, ctx: Ctx): BotReply {
  const { lang, question } = ctx;
  const t = stringsFor(lang);
  const c = t.chat;
  const reply = (text: string[], extra: Partial<BotReply> = {}): BotReply => ({ from: 'bot', lang, topic, text, ...extra });

  switch (topic) {
    case 'welcome':
      return reply(c.welcome, { quick: runtime.api ? quick(lang, 'services', 'price', 'meeting', 'plan', 'team') : quick(lang, 'services', 'price', 'plan', 'team') });

    case 'meeting':
      // Online booking needs the server; without it, the team arranges the call on WhatsApp.
      return reply(c.meeting, {
        links: runtime.api ? [page(lang, c.links.meeting, '/meeting/'), whatsapp(lang, question)] : [whatsapp(lang, question ?? t.meeting.whatsappMessage), call(lang)],
        quick: quick(lang, 'services', 'price'),
      });

    case 'greeting':
      return reply(c.greeting, { quick: quick(lang, 'services', 'price', 'plan', 'team') });

    case 'services':
      return reply(c.services, {
        quick: getServices(lang).map((s) => ({ label: s.name, topic: 'service' as const, slug: s.slug })),
        links: [page(lang, c.links.services, '/services/')],
      });

    case 'service': {
      const s = service(lang, ctx.services[0]);
      if (!s) return compose('services', ctx);
      return reply([s.summary, fill(c.idealFor, { list: s.idealFor.join(joiner(lang)) })], {
        list: s.details,
        links: [page(lang, fill(c.links.learn, { service: s.name }), `/services/${s.slug}/`), { ...plan(lang, ctx), label: fill(c.links.planWith, { service: s.name }) }],
        quick: [{ label: c.quick.price, topic: 'pricing', slug: s.slug }, ...quick(lang, 'other', 'team')],
      });
    }

    case 'pricing': {
      const s = ctx.services.length === 1 ? service(lang, ctx.services[0]) : undefined;
      return reply(s ? [fill(c.pricingFor, { service: s.name }), c.pricing[1]] : c.pricing, {
        links: [plan(lang, ctx), whatsapp(lang, question), call(lang)],
        quick: quick(lang, 'services', 'location'),
      });
    }

    case 'contact': {
      const text = [...c.contact];
      if (site.responsePromise) text.push(site.responsePromise[lang]);
      if (site.streetAddress) text.push(`${site.streetAddress}, ${t.common.location}`);
      return reply(text, { links: [whatsapp(lang, question), call(lang), email(lang)], quick: quick(lang, 'plan', 'services') });
    }

    case 'location': {
      const text = [faq(lang, 'location') ?? t.common.location];
      if (site.streetAddress) text.push(`${site.streetAddress}, ${t.common.location}`);
      const links = [whatsapp(lang, question), plan(lang, ctx)];
      if (site.googleMapsUrl) links.push({ label: c.links.map, href: site.googleMapsUrl, kind: 'external' });
      return reply(text, { links, quick: quick(lang, 'services', 'price') });
    }

    case 'hours': {
      const text = [...c.hours];
      if (site.openingHours) text.push(fill(c.hoursList, { hours: site.openingHours.map((h) => `${h.days} ${h.opens}–${h.closes}`).join(', ') }));
      return reply(text, { links: [whatsapp(lang, question), call(lang)] });
    }

    case 'availability':
      return reply(c.availability, { links: [whatsapp(lang, question), call(lang), plan(lang, ctx)], quick: quick(lang, 'price') });

    case 'start':
      return reply([faq(lang, 'start'), ...c.start].filter(Boolean) as string[], {
        links: [plan(lang, ctx), page(lang, c.links.form, '/contact/'), whatsapp(lang)],
        quick: quick(lang, 'price', 'process'),
      });

    case 'combine': {
      const names = ctx.services.map((slug) => service(lang, slug)?.name).filter(Boolean) as string[];
      return reply([faq(lang, 'combine') ?? c.occasion[1]], {
        list: names.length > 1 ? names : undefined,
        links: [plan(lang, { services: [], occasion: ctx.occasion }), whatsapp(lang, question)],
        quick: quick(lang, 'services', 'price'),
      });
    }

    case 'brief':
      return reply([faq(lang, 'brief') ?? c.start[0]], { list: t.services.brief, links: [plan(lang, ctx)], quick: quick(lang, 'price', 'team') });

    case 'teamSize':
      return reply(c.teamSize, { links: [plan(lang, ctx), whatsapp(lang, question)], quick: quick(lang, 'price') });

    case 'requirements':
      return reply(c.requirements, { links: [plan(lang, ctx), whatsapp(lang, question)], quick: quick(lang, 'services', 'price') });

    case 'process':
      return reply(c.process, {
        list: t.process.steps.map(([title, text]) => `${title} ${text}`),
        links: [plan(lang, ctx)],
        quick: quick(lang, 'price', 'work'),
      });

    case 'work':
      return reply(c.work, {
        links: [...getProjects(lang).map((p) => page(lang, p.client, `/work/${p.slug}/`)), page(lang, c.links.work, '/work/')],
        quick: quick(lang, 'services', 'plan'),
      });

    case 'about':
      return reply([t.story.text], { links: [page(lang, c.links.about, '/about/')], quick: quick(lang, 'services', 'work') });

    case 'careers':
      return reply(c.careers, { links: [page(lang, c.links.careers, '/careers/')], quick: quick(lang, 'services') });

    case 'occasion':
      return reply(c.occasion, { links: [plan(lang, ctx), whatsapp(lang, question)], quick: quick(lang, 'services', 'price') });

    case 'thanks':
      return reply(c.thanks, { links: [whatsapp(lang)], quick: quick(lang, 'services') });

    case 'fallback':
    default:
      return reply(c.fallback, { links: [whatsapp(lang, question)], quick: quick(lang, 'services', 'price', 'plan', 'team') });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/** Arabic script gets an Arabic answer; anything else follows the page language. */
export const replyLanguage = (question: string, pageLocale: Locale): Locale => (ARABIC.test(question) ? 'ar' : pageLocale);

export function welcomeMessage(locale: Locale): BotReply {
  return compose('welcome', { lang: locale, services: [], occasion: null });
}

/**
 * Answer a typed question. `misses` is how many answers in a row were "I didn't get that";
 * from the second one the assistant stops guessing and offers the team, question included.
 */
export function replyTo(question: string, pageLocale: Locale, misses = 0): BotReply {
  const asked = question.trim().slice(0, 300);
  const lang = replyLanguage(asked, pageLocale);
  const found = detect(asked);
  const ctx: Ctx = { lang, question: asked, services: found.services, occasion: found.occasion };
  if (found.topic === 'fallback' && misses >= 1) {
    const c = stringsFor(lang).chat;
    return { from: 'bot', lang, topic: 'fallback', text: c.fallbackAgain, links: [whatsapp(lang, asked), call(lang)], quick: quick(lang, 'services', 'plan') };
  }
  return compose(found.topic, ctx);
}

/** Answer a tapped suggestion chip. */
export function replyToQuick(chip: Quick, pageLocale: Locale): BotReply {
  return compose(chip.topic, { lang: pageLocale, services: chip.slug ? [chip.slug] : [], occasion: null });
}
