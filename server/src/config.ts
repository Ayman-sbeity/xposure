// Server settings, read once from environment variables (and the project's .env file).
// See .env.example in the project root for every option.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  /* no .env file: environment variables only */
}

const flag = (name: string) => process.argv.includes(name);
const env = (name: string) => process.env[name]?.trim() || undefined;

const production = flag('--production') || env('NODE_ENV') === 'production';

export type Config = {
  production: boolean;
  port: number;
  host: string;
  dataDir: string;
  /** Public address, e.g. https://xposurelb.com. Used to check where admin requests come from. */
  publicOrigin?: string;
  cookieSecure: boolean;
  trustProxy: string | boolean;
  adminEmail?: string;
  adminPassword?: string;
  zoom: { accountId?: string; clientId?: string; clientSecret?: string; userId: string; oauthBase: string; apiBase: string };
};

export const config: Config = {
  production,
  port: Number(env('PORT')) || (production ? 3000 : 5173),
  host: env('HOST') ?? '0.0.0.0',
  dataDir: path.resolve(ROOT, env('DATA_DIR') ?? 'data'),
  publicOrigin: env('PUBLIC_ORIGIN')?.replace(/\/+$/, ''),
  // Secure cookies need HTTPS. Production is HTTPS; set COOKIE_SECURE=false only for a local test.
  cookieSecure: env('COOKIE_SECURE') ? env('COOKIE_SECURE') === 'true' : production,
  // Behind a reverse proxy / load balancer (Nginx, Render, Railway…) so rate limits see real IPs.
  trustProxy: env('TRUST_PROXY') ?? (production ? 'loopback, linklocal, uniquelocal' : false),
  adminEmail: env('ADMIN_EMAIL'),
  adminPassword: env('ADMIN_PASSWORD'),
  zoom: {
    accountId: env('ZOOM_ACCOUNT_ID'),
    clientId: env('ZOOM_CLIENT_ID'),
    clientSecret: env('ZOOM_CLIENT_SECRET'),
    userId: env('ZOOM_USER_ID') ?? 'me',
    oauthBase: env('ZOOM_OAUTH_BASE') ?? 'https://zoom.us',
    apiBase: env('ZOOM_API_BASE') ?? 'https://api.zoom.us/v2',
  },
};
