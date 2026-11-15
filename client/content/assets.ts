// Local, optimized images (public/assets). Original URLs and provenance for every
// file are recorded in source-export/content/asset-manifest.json.
// Do not use photos showing regulated products or brands (e.g. tobacco or vape).
export type Asset = { file: string; width: number; height: number; alt: string; altAr: string };

export const assets = {
  hero: {
    file: '29-exposure-1023x1536.webp',
    width: 1023,
    height: 1536,
    alt: 'Xposure hostess holding a branded clipboard at an event',
    altAr: 'مضيفة من Xposure تحمل لوحة تحمل شعار الوكالة في إحدى الفعاليات',
  },
  team: {
    file: '04-Xposure-Girls-banner-2000x1000-ratio-optimized-scaled.webp',
    width: 1800,
    height: 900,
    alt: 'Four Xposure hostesses in uniform at an annual Iftar event',
    altAr: 'أربع مضيفات من Xposure بالزي الموحد في إفطار سنوي',
  },
  hostesses: {
    file: '44-C58A0437-2048x1365.webp',
    width: 1600,
    height: 1066,
    alt: 'Two Xposure hostesses in black uniforms and purple scarves ready to welcome guests',
    altAr: 'مضيفتان من Xposure بزي أسود ووشاح بنفسجي تستعدان لاستقبال الضيوف',
  },
  coordination: {
    file: '05-Xposure-3-Banner-Optimized-scaled.webp',
    width: 1800,
    height: 900,
    alt: 'Xposure team members holding branded clipboards at an event',
    altAr: 'أعضاء من فريق Xposure يحملون لوحات تحمل شعار الوكالة في فعالية',
  },
  horeca: {
    file: '36-1B2A7035-2048x1150.webp',
    width: 1600,
    height: 898,
    alt: 'Xposure hostess handing out information at Horeca Exhibition 2024',
    altAr: 'مضيفة من Xposure توزع منشورات في معرض هوريكا 2024',
  },
  horecaTalk: {
    file: '37-1B2A7055-2048x1150.webp',
    width: 1600,
    height: 898,
    alt: 'Xposure team member talking with visitors at Horeca Exhibition 2024',
    altAr: 'عضو من فريق Xposure تتحدث مع زوار في معرض هوريكا 2024',
  },
  horecaMeeting: {
    file: '38-1B2A7076-2048x1150.webp',
    width: 1600,
    height: 898,
    alt: 'A meeting at the Xposure stand during Horeca Exhibition 2024',
    altAr: 'اجتماع في جناح Xposure خلال معرض هوريكا 2024',
  },
  horecaStand: {
    file: '39-1B2A7552-2048x1150.webp',
    width: 1600,
    height: 898,
    alt: 'Xposure team member taking notes with a visitor at the Xposure stand',
    altAr: 'عضو من فريق Xposure تدوّن ملاحظات مع زائر في جناح Xposure',
  },
} as const satisfies Record<string, Asset>;

export type AssetKey = keyof typeof assets;

export const assetUrl = (key: AssetKey): string => `/assets/${assets[key].file}`;
