/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical public origin, e.g. https://xposurelb.com (no trailing slash). */
  readonly VITE_SITE_URL?: string;
  /** "true" only for the approved production deployment. Anything else = noindex. */
  readonly VITE_SITE_INDEXABLE?: string;
  /** Google Tag Manager container ID (GTM-XXXXXXX). Empty = no analytics and no consent banner. */
  readonly VITE_GTM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
