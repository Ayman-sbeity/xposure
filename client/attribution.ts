// CAMPAIGN LINKS, without cookies.
// Add utm tags to any link you share, e.g. an Instagram bio or an ad:
//   https://xposurelb.com/plan/?utm_source=instagram&utm_campaign=ramadan-2027
// The enquiry message the visitor sends then ends with "Found Xposure via: instagram / ramadan-2027",
// so the team can see which post or ad brought each lead. The tags are read from the address
// of the current page only: nothing is stored, and the visitor sees the line before sending.

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign'] as const;

/** "instagram / bio / ramadan-2027", or null when the page address has no campaign tags. */
export function campaignFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const parts = KEYS.map((key) =>
    (params.get(key) ?? '')
      .replace(/[^\p{L}\p{N} ._\-+]/gu, '')
      .trim()
      .slice(0, 60),
  ).filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

/** Message lines to append to an enquiry, or nothing. */
export function campaignLines(): string[] {
  const campaign = campaignFromUrl();
  return campaign ? ['', `Found Xposure via: ${campaign}`] : [];
}
