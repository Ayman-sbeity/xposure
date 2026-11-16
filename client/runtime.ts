// How the page is being served. The Node server sets `api: true` (in entry-server before
// rendering, and in the page's data block for the browser), so forms save to the admin inbox
// and meeting booking is available. A plain static export leaves it false: forms then fall
// back to ready-written WhatsApp / email drafts, exactly as before.
import type { ContentOverrides, MediaItem } from './content/editable';

export const runtime = { api: false };

/** The JSON the server embeds in every page (<script type="application/json" id="xp-data">). */
export type PageData = { api: boolean; content: ContentOverrides; media: MediaItem[] };

export const DATA_ELEMENT_ID = 'xp-data';
