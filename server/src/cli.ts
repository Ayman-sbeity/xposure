// Admin accounts from the command line (e.g. a forgotten password).
//   npm run admin -- create <email> <password> [name]
//   npm run admin -- password <email> <new-password>
//   npm run admin -- list
import path from 'node:path';
import { createAdmin, setPassword } from './auth.ts';
import { config } from './config.ts';
import { logActivity, openDatabase } from './db.ts';

const [command, email, password, ...name] = process.argv.slice(2).filter((arg) => arg !== '--production');
const db = openDatabase(path.join(config.dataDir, 'xposure.db'));

try {
  if (command === 'create' && email && password) {
    const id = await createAdmin(db, email, password, name.join(' ') || 'Admin');
    logActivity(db, null, 'Admin account created (command line)', email);
    console.log(`Created admin #${id} for ${email}.`);
  } else if (command === 'password' && email && password) {
    const row = db.prepare('SELECT id FROM admins WHERE email = ?').get(email.toLowerCase()) as { id: number } | undefined;
    if (!row) throw new Error(`No admin with the email ${email}.`);
    await setPassword(db, row.id, password);
    logActivity(db, null, 'Password reset (command line)', email);
    console.log(`Password updated for ${email}. All sessions were signed out.`);
  } else if (command === 'list') {
    for (const row of db.prepare('SELECT id, email, name, last_login_at FROM admins ORDER BY id').all()) console.log(row);
  } else {
    console.log('Usage:\n  npm run admin -- create <email> <password> [name]\n  npm run admin -- password <email> <new-password>\n  npm run admin -- list');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
