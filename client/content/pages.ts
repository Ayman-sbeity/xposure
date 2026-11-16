// PAGE TITLES AND DESCRIPTIONS for search engines and link previews, per language.
// Editable in the admin panel (Content > Page titles & SEO). Keep titles under ~60 characters
// and descriptions between ~110 and 160 characters.
import type { Localized } from '../i18n';
import { site } from './site';

export type PageText = { title: string; description: string };
export type PageKey = 'home' | 'about' | 'services' | 'work' | 'contact' | 'careers' | 'plan' | 'meeting';

export const pageText: Record<PageKey, Localized<PageText>> = {
  plan: {
    en: {
      title: 'Plan Your Event & Request a Proposal | Xposure',
      description:
        'Plan your event with Xposure in four quick steps: choose the occasion and services, add the details, and send your brief by WhatsApp or email.',
    },
    ar: {
      title: 'خطّط لفعاليتك واطلب عرضاً | Xposure',
      description:
        'خطّط لفعاليتك مع Xposure في أربع خطوات سريعة: اختر المناسبة والخدمات، أضف التفاصيل، ثم أرسل طلبك عبر واتساب أو البريد الإلكتروني.',
    },
  },
  home: {
    en: {
      title: 'Xposure | Hostess & Promoter Agency in Beirut, Lebanon',
      description:
        'Xposure is a Beirut-based hostess and promoter agency: hostesses, receptionists, event coordination, promoters and photo marketing for events in Lebanon.',
    },
    ar: {
      title: 'Xposure | وكالة مضيفات ومروّجين في بيروت، لبنان',
      description:
        'Xposure وكالة مضيفات ومروّجين مقرها بيروت: مضيفات، موظفو استقبال، تنسيق فعاليات، مروّجون وتسويق بالصور لفعاليات الشركات والمعارض في لبنان.',
    },
  },
  about: {
    en: {
      title: 'About Xposure | Hostess Company in Lebanon',
      description:
        'Meet Xposure, a Beirut-based hostess and promoter agency bringing professional talent and event coordination to corporate events, exhibitions and occasions.',
    },
    ar: {
      title: 'عن Xposure | وكالة مضيفات في لبنان',
      description:
        'تعرّف على Xposure، وكالة مضيفات ومروّجين مقرها بيروت توفّر فريقاً محترفاً وخدمات تنسيق الفعاليات للشركات والمعارض والمناسبات الخاصة في لبنان.',
    },
  },
  services: {
    en: {
      title: 'Event Staffing Services in Lebanon | Xposure',
      description:
        'Hostesses, receptionists, event coordination, promotion and sales teams, photo marketing and brand consulting from Xposure, a Beirut-based agency.',
    },
    ar: {
      title: 'خدمات فرق عمل الفعاليات في لبنان | Xposure',
      description:
        'مضيفات، موظفو استقبال، تنسيق فعاليات، فرق ترويج ومبيعات، تسويق بالصور واستشارات العلامة التجارية من Xposure، وكالة مقرها بيروت.',
    },
  },
  work: {
    en: {
      title: 'Selected Work: Events & Exhibitions | Xposure',
      description:
        'A selection of events and exhibitions Xposure has supported, including the Ezzeddine Plus annual Iftar and Horeca Exhibition 2024.',
    },
    ar: {
      title: 'أعمالنا: فعاليات ومعارض | Xposure',
      description:
        'مجموعة من الفعاليات والمعارض التي شاركت فيها Xposure، ومنها إفطار Ezzeddine Plus السنوي ومعرض هوريكا 2024 في لبنان، مع صور وتفاصيل كل مشروع.',
    },
  },
  contact: {
    en: {
      title: 'Contact Xposure | Book Hostesses & Event Staff in Beirut',
      description: `Tell Xposure about your event. Email ${site.email}, call or WhatsApp ${site.phoneDisplay}, or send your brief through the enquiry form.`,
    },
    ar: {
      title: 'تواصل مع Xposure | احجز مضيفات وفريق فعاليات في بيروت',
      description: `أخبر Xposure عن فعاليتك. راسلنا على ${site.email} أو اتصل أو راسلنا عبر واتساب على ${site.phoneDisplay}، أو أرسل تفاصيل طلبك عبر النموذج.`,
    },
  },
  careers: {
    en: {
      title: 'Careers: Hostess & Promoter Jobs in Lebanon | Xposure',
      description:
        'Apply to work with Xposure as a hostess, promoter or receptionist at events in Lebanon. Send your details and we’ll contact you about suitable roles.',
    },
    ar: {
      title: 'وظائف مضيفات ومروّجين في لبنان | Xposure',
      description:
        'قدّم طلبك للعمل مع Xposure كمضيفة أو مروّج أو موظف استقبال في فعاليات لبنان. أرسل بياناتك وسنتواصل معك عند توفّر فرصة مناسبة لك.',
    },
  },
  meeting: {
    en: {
      title: 'Book a Zoom Meeting with Xposure | Beirut, Lebanon',
      description:
        'Book a video call with the Xposure team on Zoom. Pick a time that suits you, ask your questions and talk through your event plans with us.',
    },
    ar: {
      title: 'احجز اجتماع Zoom مع Xposure | بيروت، لبنان',
      description:
        'احجز مكالمة فيديو عبر Zoom مع فريق Xposure. اختر الوقت المناسب لك، واطرح أسئلتك وناقش معنا تفاصيل فعاليتك القادمة في لبنان.',
    },
  },
};
