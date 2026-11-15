import type { Locale } from '../i18n';
import { faqsAr } from './ar';

/** `id` lets the chat assistant find an answer by meaning, so the FAQs can be reordered freely. */
export type FaqId = 'services' | 'location' | 'combine' | 'brief' | 'start';
export type Faq = { id?: FaqId; q: string; a: string };

export const faqs: Faq[] = [
  {
    id: 'services',
    q: 'What can Xposure help with?',
    a: 'Our services include hostesses, receptionists, event coordination, promotion and sales, photo marketing and brand consulting. Tell us about your occasion and we’ll discuss the right scope.',
  },
  {
    id: 'location',
    q: 'Where is the agency based?',
    a: 'Xposure is based in Beirut, Lebanon. Get in touch with your event location to discuss availability and logistics.',
  },
  {
    id: 'combine',
    q: 'Can Xposure combine several services for one event?',
    a: 'Yes. Tell us what your event needs and we’ll suggest how hosting, coordination, promotion and photo marketing can work together.',
  },
  {
    id: 'brief',
    q: 'What should I include in my enquiry?',
    a: 'Share the event date, location, type of occasion and the services you’re interested in. Timings, the number of people you need and any dress code or brand guidelines help us respond with the right proposal.',
  },
  {
    id: 'start',
    q: 'How do we start working together?',
    a: 'Send us your event date, location, service needs and a short brief through the enquiry form, by email or on WhatsApp. Our team will follow up to discuss the details.',
  },
];

export const getFaqs = (locale: Locale): Faq[] => (locale === 'ar' ? faqsAr : faqs);
