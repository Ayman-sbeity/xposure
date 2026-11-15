import type { Localized } from '../i18n';
import type { AssetKey } from './assets';

// SOCIAL PROOF. Nothing here is displayed until `approved` is true.
// Set `approved: true` only when the named person / company has confirmed, in writing,
// that Xposure may publish it. Never write or edit a quote yourself.

export type Testimonial = {
  quote: Localized<string>;
  name: string;
  role: Localized<string>;
  company: string;
  approved: boolean;
  source: string;
};

const OLD_SERVICES_PAGE = 'https://xposurelb.com/index.php/xposure-services/';

export const testimonials: Testimonial[] = [
  {
    // Published on the previous website. Re-confirm before reuse. The original says
    // "Exposure"; ask whether the spelling may be corrected. The quote refers to promoting
    // the client's products: check it against the rule on regulated client products.
    quote: {
      en: 'Exposure played an important role in promoting my products, it helped in increasing sales and attaining new customers.',
      ar: '',
    },
    name: 'Mr. Mahdi Ezzeddine',
    role: { en: 'CEO', ar: 'الرئيس التنفيذي' },
    company: 'Ezzeddine Plus',
    approved: false,
    source: OLD_SERVICES_PAGE,
  },
  // The previous site also carried a testimonial from the General Manager of Puffzone.
  // It is not included because Puffzone sells regulated (vape/tobacco) products.
];

/** `category` is the tab the logo appears under in the "Our Clients" section. */
export type ClientLogo = { name: string; logo: AssetKey; category: Localized<string>; approved: boolean };

// Add entries once each client has agreed to be listed, for example:
//   { name: 'Client name', logo: 'clientLogoKey', category: { en: 'Hospitality', ar: 'الضيافة' }, approved: true },
// Logos must first be added to client/content/assets.ts. Do not list regulated-product brands.
export const clientLogos: ClientLogo[] = [];

export const approvedTestimonials = (): Testimonial[] => testimonials.filter((t) => t.approved);
export const approvedLogos = (): ClientLogo[] => clientLogos.filter((c) => c.approved);
