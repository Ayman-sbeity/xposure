import type { Localized } from '../i18n';

// KEY FIGURES ("Xposure in numbers") shown on the home page with a count-up animation.
// Nothing is displayed until an entry has `approved: true`.
// Only add a figure the team can prove (bookings records, staff lists, client confirmation).
// Never estimate or round up. `source` is a note for the team on where the figure comes from.
//
// Example:
//   {
//     value: 120,
//     suffix: '+',
//     label: { en: 'events staffed since 2019', ar: 'فعالية منذ 2019' },
//     approved: true,
//     source: 'Booking spreadsheet, checked 1 Dec 2026',
//   },

export type Stat = {
  value: number;
  /** Shown before / after the number, e.g. '+' or '%'. */
  prefix?: string;
  suffix?: string;
  label: Localized<string>;
  approved: boolean;
  source: string;
};

export const stats: Stat[] = [];

export const approvedStats = (): Stat[] => stats.filter((stat) => stat.approved);
