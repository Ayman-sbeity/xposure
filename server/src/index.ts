// Starts the Xposure website, its API and the admin panel.
//   npm run dev     development (instant reload)      http://localhost:5173
//   npm start       production (after npm run build)   http://localhost:3000
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createApp } from './app.ts';
import { createAdmin } from './auth.ts';
import { config } from './config.ts';
import { openDatabase, type Db } from './db.ts';

const db = openDatabase(path.join(config.dataDir, 'xposure.db'));
await ensureFirstAdmin(db);

const server = http.createServer();
const { app, site } = await createApp({ db, production: config.production, dataDir: config.dataDir, httpServer: server });
server.on('request', app);
server.listen(config.port, config.host, () => {
  const base = `http://localhost:${config.port}`;
  console.log(`\n  Xposure ${config.production ? '(production)' : '(development)'}\n  Website       ${base}/\n  Admin panel   ${base}/admin/\n`);
});

async function shutdown() {
  server.close();
  await site.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * The first admin account. In production it comes from ADMIN_EMAIL / ADMIN_PASSWORD (or the
 * `npm run admin` command). In development one is created with a random password, printed
 * here and saved in data/ADMIN-LOGIN.txt.
 */
async function ensureFirstAdmin(database: Db): Promise<void> {
  const { n } = database.prepare('SELECT COUNT(*) AS n FROM admins').get() as { n: number };
  if (Number(n) > 0) return;
  if (config.adminEmail && config.adminPassword) {
    await createAdmin(database, config.adminEmail, config.adminPassword, 'Admin');
    console.log(`  Admin account created for ${config.adminEmail}.`);
    return;
  }
  if (config.production) {
    console.warn('  No admin account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, or run: npm run admin -- create <email> <password>');
    return;
  }
  const email = 'admin@xposurelb.com';
  const password = crypto.randomBytes(9).toString('base64url');
  await createAdmin(database, email, password, 'Xposure admin');
  const note = `Xposure admin panel (development)\n\nAddress:  http://localhost:${config.port}/admin/\nEmail:    ${email}\nPassword: ${password}\n\nChange the password in Settings after signing in, then delete this file.\n`;
  fs.writeFileSync(path.join(config.dataDir, 'ADMIN-LOGIN.txt'), note);
  console.log(`\n  First admin account created\n  Email:    ${email}\n  Password: ${password}\n  (also saved in data/ADMIN-LOGIN.txt)`);
}
