import type { Locale } from '../i18n';
import { servicesAr } from './ar';
import type { AssetKey } from './assets';

// Adapted from https://xposurelb.com/index.php/xposure-services/ and the home and
// about pages. Editorial copy is a proposal: no invented clients, numbers or outcomes.
// `name` values must match the enquiry enum in server/src/validation.ts.
export type Service = {
  slug: string;
  name: string;
  tag: string;
  summary: string;
  details: string[];
  image: AssetKey;
  heading: { main: string; accent: string };
  intro: string;
  body: string[];
  idealFor: string[];
  relatedProject?: string;
  metaTitle: string;
  metaDescription: string;
  source: string;
};

const SERVICES_SOURCE = 'https://xposurelb.com/index.php/xposure-services/';

export const services: Service[] = [
  {
    slug: 'hostesses-and-receptionists',
    name: 'Hostesses & receptionists',
    tag: 'THE RIGHT FIRST IMPRESSION',
    summary:
      'A warm welcome. A confident presence. Our professional hosts and receptionists help your guests feel looked after, from arrival to the final goodbye.',
    details: [
      'Guest welcome & assistance',
      'Reception & enquiry management',
      'Talent selection & preparation',
    ],
    image: 'hostesses',
    heading: { main: 'Hostesses & receptionists', accent: 'in Lebanon.' },
    intro:
      'Professional hosts who greet, guide and look after your guests, so every arrival feels expected and every question finds an answer.',
    body: [
      'First impressions start at the door. Xposure hostesses greet your guests, guide them through the venue and stay on hand to assist, bringing warmth and professionalism to every interaction.',
      'Our receptionists keep arrivals and questions moving smoothly. They manage enquiries, provide assistance and help guests reach the right people at the right time.',
    ],
    idealFor: ['Corporate events', 'Exhibitions & trade shows', 'Promotional campaigns', 'Special occasions'],
    relatedProject: 'ezzeddine-plus-iftar-2024',
    metaTitle: 'Hostesses & Receptionists in Lebanon | Xposure',
    metaDescription:
      'Professional event hostesses and receptionists in Lebanon for corporate events, exhibitions and special occasions. Share your brief with Xposure in Beirut.',
    source: SERVICES_SOURCE,
  },
  {
    slug: 'event-coordination',
    name: 'Event coordination',
    tag: 'EVERY DETAIL, CONSIDERED',
    summary:
      'From the initial conversation to on-site implementation, we coordinate the moving parts so your event comes together with care and precision.',
    details: ['Initial consultation', 'Planning & preparation', 'On-site coordination'],
    image: 'coordination',
    heading: { main: 'Event coordination', accent: 'in Lebanon.' },
    intro:
      'One team to coordinate the people, timings and details of your event, from the first conversation to the moment the last guest leaves.',
    body: [
      'Every event has moving parts. Our coordination team works through them with you, starting with an initial consultation, moving into planning and preparation, and finishing with on-site coordination on the day.',
      'Coordination can stand alone or bring other Xposure services together, such as hosting, guest engagement and photo experiences, into a single plan.',
    ],
    idealFor: ['Corporate gatherings', 'Company celebrations', 'Exhibitions', 'Special occasions'],
    relatedProject: 'ezzeddine-plus-iftar-2024',
    metaTitle: 'Event Coordination in Lebanon | Xposure',
    metaDescription:
      'Event coordination in Lebanon, from initial consultation and planning to on-site coordination. Xposure brings the people and details of your event together.',
    source: SERVICES_SOURCE,
  },
  {
    slug: 'promotion-and-sales',
    name: 'Promotion & sales',
    tag: 'PEOPLE WHO CONNECT',
    summary:
      'Bring your brand into the room with a dedicated team of promoters. We match professional talent to your brief, audience and occasion.',
    details: ['Promotional staffing', 'Customer engagement', 'Brand representation'],
    image: 'horeca',
    heading: { main: 'Promoters & sales teams', accent: 'in Lebanon.' },
    intro:
      'Promoters who put a friendly, informed face on your brand and start the conversations that build awareness.',
    body: [
      'Xposure selects promotion and sales staff to match your brief, audience and occasion, then prepares them to represent your brand with confidence.',
      'Our teams engage customers and visitors, start conversations and help your brand get noticed, whether on an exhibition stand or during a promotional campaign.',
    ],
    idealFor: ['Promotional campaigns', 'Exhibitions & trade shows', 'Brand activations', 'Corporate events'],
    relatedProject: 'horeca-exhibition-2024',
    metaTitle: 'Promoters & Sales Staff in Lebanon | Xposure',
    metaDescription:
      'Professional promoters and sales staff in Lebanon. Xposure matches promotion teams to your brief, audience and occasion to help your brand get noticed.',
    source: SERVICES_SOURCE,
  },
  {
    slug: 'photo-marketing',
    name: 'Photo marketing',
    tag: 'MAKE THE MOMENT LAST',
    summary:
      'Interactive photo experiences that capture your event and give guests a moment to remember, with your brand thoughtfully woven into the experience.',
    details: ['Interactive event photography', 'Guest engagement', 'Branded photo experiences'],
    image: 'team',
    heading: { main: 'Photo marketing', accent: 'for events.' },
    intro:
      'Interactive photo experiences that engage your guests, capture the moment and keep your brand part of the memory.',
    body: [
      'Photo marketing turns a moment into something guests keep. Xposure creates interactive photo experiences for your event, with your brand identity integrated into the experience.',
      'At the Ezzeddine Plus annual Iftar, an interactive photo booth captured the joy of the evening and gave guests a moment to take home.',
    ],
    idealFor: ['Corporate celebrations', 'Brand activations', 'Exhibitions', 'Special occasions'],
    relatedProject: 'ezzeddine-plus-iftar-2024',
    metaTitle: 'Photo Marketing & Event Photo Booths in Lebanon | Xposure',
    metaDescription:
      'Interactive photo marketing for events in Lebanon. Branded photo experiences from Xposure that engage guests and keep your brand part of the moment.',
    source: SERVICES_SOURCE,
  },
  {
    slug: 'brand-consulting',
    name: 'Brand consulting',
    tag: 'A CLEARER DIRECTION',
    summary:
      'Turn your vision into a focused brief. Our consulting services help shape your brand presence around your goals and the experience you want to create.',
    details: ['Brand presence', 'Experience planning', 'Project direction'],
    image: 'horecaMeeting',
    heading: { main: 'Brand consulting', accent: 'for experiences.' },
    intro:
      'Strategic guidance tailored to your goals, so your brand shows up with clarity at every event and touchpoint.',
    body: [
      'Brand consulting helps you turn a vision into a focused brief. Xposure offers strategic guidance tailored to your goals, shaping how your brand shows up at events and in front of your audience.',
      'We help you clarify the experience you want to create, then plan the people, presence and details that support it.',
    ],
    idealFor: ['New brand presence', 'Event concepts', 'Exhibition participation', 'Campaign planning'],
    metaTitle: 'Brand Consulting for Events in Lebanon | Xposure',
    metaDescription:
      'Brand consulting from Xposure in Beirut: strategic guidance that shapes your brand presence, event experience and project direction around your goals.',
    source: SERVICES_SOURCE,
  },
];

/** A service in the page language. `enquiryName` is always the English name the API expects. */
export type LocalService = Service & { enquiryName: string };

export function getServices(locale: Locale): LocalService[] {
  return services.map((service) => ({
    ...service,
    ...(locale === 'ar' ? servicesAr[service.slug] : {}),
    enquiryName: service.name,
  }));
}

export const findService = (slug: string): Service | undefined =>
  services.find((service) => service.slug === slug);
