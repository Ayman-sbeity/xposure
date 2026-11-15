// HOME PAGE CONTENT YOU CAN EDIT YOURSELF.
// See EDITING.md in the project folder for step-by-step instructions.
import type { Localized } from '../i18n';
import type { AssetKey } from './assets';

// ---------------------------------------------------------------------------
// 1. HERO SLIDER
// Each slide = one photo + a big caption + a small label + a button.
//   image   : a photo name from client/content/assets.ts (wide photos work best)
//   caption : the large text (keep it short)
//   label   : the small line above the caption
//   link    : where the button goes (always write the English path)
// Add, remove or reorder slides freely. Only use captions that are true.
// ---------------------------------------------------------------------------
export type Slide = {
  image: AssetKey;
  caption: Localized<string>;
  label: Localized<string>;
  button: Localized<string>;
  link: string;
};

export const slides: Slide[] = [
  {
    image: 'team',
    caption: { en: 'Great events. Even better people.', ar: 'فعاليات مميّزة. وفريق أكثر تميّزاً.' },
    label: { en: 'Xposure', ar: 'Xposure' },
    button: { en: 'Plan your event', ar: 'خطّط لفعاليتك' },
    link: '/plan/',
  },
  {
    image: 'hostesses',
    caption: { en: 'An evening, beautifully brought together.', ar: 'أمسية اكتملت بكل تفاصيلها.' },
    label: { en: 'Ezzeddine Plus annual Iftar', ar: 'إفطار Ezzeddine Plus السنوي' },
    button: { en: 'View the project', ar: 'شاهد المشروع' },
    link: '/work/ezzeddine-plus-iftar-2024/',
  },
  {
    image: 'horecaStand',
    caption: { en: 'A presence that stands out.', ar: 'حضور يلفت الأنظار.' },
    label: { en: 'Horeca Exhibition 2024', ar: 'معرض هوريكا 2024' },
    button: { en: 'View the project', ar: 'شاهد المشروع' },
    link: '/work/horeca-exhibition-2024/',
  },
  {
    image: 'coordination',
    caption: { en: 'Every detail, considered.', ar: 'كل تفصيل محسوب.' },
    label: { en: 'Event coordination', ar: 'تنسيق الفعاليات' },
    button: { en: 'Explore the service', ar: 'اكتشف الخدمة' },
    link: '/services/event-coordination/',
  },
];

/** Seconds each slide stays on screen. */
export const SLIDE_SECONDS = 6;

// ---------------------------------------------------------------------------
// 2. SERVICE CIRCLES
// The colour wash over each round service photo, in order of the services in
// client/content/services.ts. Use any CSS colour. Add one colour per service.
// ---------------------------------------------------------------------------
export const circleTints: string[] = ['#0e8f9b', '#c2188f', '#d98a00', '#6d3fc4', '#1f6fd1'];
