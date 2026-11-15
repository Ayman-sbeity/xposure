// Business facts used across the site, metadata and structured data.
// Source: https://xposurelb.com/ and https://xposurelb.com/index.php/contact/
//
// OWNER-SUPPLIED FIELDS: everything set to `null` below is switched off until the
// owner provides a verified value. Nothing is displayed or published for a null field.

export type OpeningHours = { days: string; opens: string; closes: string };

type Site = {
  name: string;
  url: string;
  indexable: boolean;
  gtmId: string;
  email: string;
  phone: string;
  phoneDisplay: string;
  whatsappNumber: string;
  locality: string;
  countryCode: string;
  countryName: string;
  socials: { instagram: string; linkedin: string };
  logo: { src: string; width: number; height: number };
  shareImage: { src: string; width: number; height: number; alt: string };
  /** Full street address exactly as on the Google Business Profile. */
  streetAddress: string | null;
  postalCode: string | null;
  /** e.g. [{ days: 'Mo-Fr', opens: '09:00', closes: '18:00' }] (schema.org day codes). */
  openingHours: OpeningHours[] | null;
  /** The "Share" link of the Google Business Profile / Maps listing. */
  googleMapsUrl: string | null;
  geo: { latitude: number; longitude: number } | null;
  /** Path of the company profile PDF placed in /public, e.g. '/xposure-company-profile.pdf'. */
  companyProfilePdf: string | null;
  /** A response-time promise the team commits to, per language. Leave null until agreed. */
  responsePromise: { en: string; ar: string } | null;
  /** True only after a native Arabic speaker has reviewed client/i18n and content/ar.ts. */
  arabicReviewed: boolean;
};

export const site: Site = {
  name: 'Xposure',
  url: (import.meta.env.VITE_SITE_URL || 'https://xposurelb.com').replace(/\/+$/, ''),
  indexable: import.meta.env.VITE_SITE_INDEXABLE === 'true',
  gtmId: /^GTM-[A-Z0-9]+$/.test(import.meta.env.VITE_GTM_ID || '') ? (import.meta.env.VITE_GTM_ID as string) : '',
  email: 'info@xposurelb.com',
  phone: '+96176853602',
  phoneDisplay: '+961 76 853 602',
  whatsappNumber: '96176853602',
  locality: 'Beirut',
  countryCode: 'LB',
  countryName: 'Lebanon',
  // The current public site uses inconsistent Instagram usernames.
  // Confirm the official account with the owner before production.
  socials: {
    instagram: 'https://www.instagram.com/xposure_lb/',
    linkedin: 'https://www.linkedin.com/company/xposure-lb/',
  },
  logo: { src: '/assets/xposure-original-logo.png', width: 400, height: 97 },
  shareImage: {
    src: '/og-image.jpg',
    width: 1200,
    height: 630,
    alt: 'Xposure hostesses in uniform at an event in Lebanon',
  },

  streetAddress: null,
  postalCode: null,
  openingHours: null,
  googleMapsUrl: null,
  geo: null,
  companyProfilePdf: null,
  responsePromise: null,
  arabicReviewed: false,
};

export function whatsappLink(message: string): string {
  return `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
