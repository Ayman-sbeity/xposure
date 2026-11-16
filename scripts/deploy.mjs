#!/usr/bin/env node
// One-command deployment to the production server. Settings: deploy/deploy.config.json.
//
//   npm run deploy            build, test, upload and switch the live site. If the new version
//                             does not start, the server puts the previous one back by itself.
//   npm run deploy:setup      prepare the server (first time), or re-apply its settings and install updates
//   npm run deploy:rollback   go back to the previous version
//   npm run deploy:status     what is live, memory, disk, latest backups
//   npm run deploy:logs       the site's recent log lines
//   npm run deploy:backup     download the newest database backup to backups/
//
// Option: npm run deploy -- --skip-tests
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const cfg = JSON.parse(fs.readFileSync('deploy/deploy.config.json', 'utf8'));
const HOST = process.env.DEPLOY_HOST || cfg.host;
const KEY = (process.env.DEPLOY_KEY || cfg.sshKey).replace(/^~(?=$|[\\/])/, os.homedir());
const SITE = `https://${cfg.domain}`;
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const command = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'deploy';
const win = process.platform === 'win32';
const STAGE = '.deploy';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const step = (s) => console.log(`\n${bold(`• ${s}`)}`);
function fail(message) {
  console.error(`\n\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

function run(cmd, args, { capture = false, ...options } = {}) {
  const result = spawnSync(cmd, args, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8', ...options });
  if (result.error) fail(`${cmd}: ${result.error.message}`);
  if (result.status !== 0) fail(`${cmd} ${args.slice(-1)[0]} stopped with exit code ${result.status}`);
  return capture ? result.stdout.trim() : '';
}
// Run npm through the same Node and npm that started this script (no shell needed on Windows).
const npm = (args, env = {}) =>
  process.env.npm_execpath
    ? run(process.execPath, [process.env.npm_execpath, ...args], { env: { ...process.env, ...env } })
    : run(win ? `npm ${args.join(' ')}` : 'npm', win ? [] : args, { shell: win, env: { ...process.env, ...env } });
// Windows' own tar (bsdtar) understands C:\ paths; elsewhere the system tar.
const tar = (args) => run(win && fs.existsSync('C:\\Windows\\System32\\tar.exe') ? 'C:\\Windows\\System32\\tar.exe' : 'tar', args);

const sshOptions = ['-i', KEY, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15'];
const ssh = (user, remote, options) => run('ssh', [...sshOptions, `${user}@${HOST}`, remote], options);
const upload = (local, user, remote) => run('scp', ['-q', ...sshOptions, local, `${user}@${HOST}:${remote}`]);
const download = (user, remote, local) => run('scp', ['-q', ...sshOptions, `${user}@${HOST}:${remote}`, local]);

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function releaseId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${stamp}-${git(['rev-parse', '--short=7', 'HEAD']) || 'nogit'}${git(['status', '--porcelain']) ? '-dirty' : ''}`;
}

async function checkOnline(url) {
  for (let i = 0; i < 10; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return true;
    } catch {
      /* certificate still being issued, or restarting */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

async function deploy() {
  const started = Date.now();
  if (!fs.existsSync(KEY)) fail(`SSH key not found: ${KEY}`);
  const id = releaseId();
  if (id.endsWith('-dirty')) console.log('  Note: this release includes changes that are not committed to git.');

  step('Building');
  npm(['run', 'build'], { VITE_SITE_URL: cfg.siteUrl, VITE_SITE_INDEXABLE: cfg.indexable ? 'true' : 'false' });
  if (!flags.includes('--skip-tests')) {
    step('Testing');
    npm(['test']);
  }

  step('Packaging');
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE);
  tar(['-czf', `${STAGE}/release.tgz`, 'dist', '.ssr', 'server/src', 'package.json', 'package-lock.json']);
  const mb = (fs.statSync(`${STAGE}/release.tgz`).size / 1048576).toFixed(1);

  step(`Uploading ${id} (${mb} MB) to ${HOST}`);
  upload(`${STAGE}/release.tgz`, 'deploy', `/srv/xposure/incoming/${id}.tgz`);

  step('Installing on the server');
  ssh('deploy', `xposure-deploy ${id}`);
  fs.rmSync(STAGE, { recursive: true, force: true });

  step(`Checking ${SITE}`);
  const ok = await checkOnline(`${SITE}/api/health`);
  const seconds = Math.round((Date.now() - started) / 1000);
  if (!ok) fail(`The server reports the release is live, but ${SITE} did not answer from here. Try npm run deploy:status.`);
  console.log(`\n${bold('✓ Deployed')} ${id} in ${seconds} s\n  Website      ${SITE}/\n  Admin panel  ${SITE}/admin/\n`);
}

function setup() {
  if (!fs.existsSync(`${KEY}.pub`)) fail(`Public key not found: ${KEY}.pub`);
  const values = {
    PRIMARY_DOMAIN: cfg.domain,
    REDIRECT_DOMAINS: (cfg.redirectDomains ?? []).join(' '),
    SERVER_IP: HOST,
    DEPLOY_PUBKEY: fs.readFileSync(`${KEY}.pub`, 'utf8').trim(),
    ADMIN_EMAIL: cfg.adminEmail,
    ADMIN_PASSWORD: firstAdminPassword(),
  };
  for (const [name, value] of Object.entries(values)) {
    if (/['\n\r]/.test(String(value))) fail(`${name} contains a quote or line break`);
  }

  step(`Preparing ${HOST} (as root)`);
  const dir = `${STAGE}/setup`;
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync('deploy/server')) {
    // Scripts must have Unix line endings even if git converted them on Windows.
    fs.writeFileSync(path.join(dir, name), fs.readFileSync(path.join('deploy/server', name), 'utf8').replace(/\r\n/g, '\n'));
  }
  fs.writeFileSync(path.join(dir, 'setup.env'), Object.entries(values).map(([k, v]) => `${k}='${v}'`).join('\n') + '\n');
  tar(['-czf', `${STAGE}/setup.tgz`, '-C', dir, '.']);
  fs.rmSync(dir, { recursive: true, force: true });
  upload(`${STAGE}/setup.tgz`, 'root', '/root/xposure-setup.tgz');
  fs.rmSync(STAGE, { recursive: true, force: true });
  ssh(
    'root',
    'set -e; rm -rf /root/xposure-setup; mkdir -m 700 /root/xposure-setup; ' +
      'tar -xzf /root/xposure-setup.tgz -C /root/xposure-setup --no-same-owner --warning=no-unknown-keyword; ' +
      'rm -f /root/xposure-setup.tgz; bash /root/xposure-setup/setup.sh',
  );
}

/** Generated once and kept in data/ (not in git). The server uses it only if it has no settings yet. */
function firstAdminPassword() {
  const file = 'data/PRODUCTION-ADMIN.txt';
  if (fs.existsSync(file)) {
    const found = /Password:\s*(\S+)/.exec(fs.readFileSync(file, 'utf8'));
    if (found) return found[1];
  }
  const password = crypto.randomBytes(15).toString('base64url');
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(
    file,
    `Xposure admin panel (production)\n\nAddress:  ${SITE}/admin/\nEmail:    ${cfg.adminEmail}\nPassword: ${password}\n\n` +
      'Sign in, change the password in Settings, then delete this file.\n',
  );
  return password;
}

async function backup() {
  const latest = ssh('deploy', 'ls -1t /var/backups/xposure/xposure-*.db.gz 2>/dev/null | head -n 1', { capture: true });
  if (!latest) fail('No backup on the server yet.');
  fs.mkdirSync('backups', { recursive: true });
  download('deploy', latest, `backups/${path.posix.basename(latest)}`);
  console.log(`✓ Saved backups/${path.posix.basename(latest)}`);
}

const commands = {
  deploy,
  setup,
  backup,
  rollback: () => ssh('deploy', 'sudo -n /usr/local/sbin/xposure-activate rollback'),
  logs: () => ssh('deploy', 'journalctl -u xposure -n 80 --no-pager -o short-iso'),
  status: () =>
    ssh(
      'deploy',
      'echo "Live:      $(basename "$(readlink -e /srv/xposure/current)")"; ' +
        'echo "Previous:  $(basename "$(readlink -e /srv/xposure/previous 2>/dev/null)" 2>/dev/null)"; ' +
        'echo "Services:  site $(systemctl is-active xposure), web server $(systemctl is-active caddy)"; ' +
        'echo "Memory:    $(free -m | awk \'/Mem/ {print $3 " of " $2 " MB used"}\')"; ' +
        'echo "Disk:      $(df -h / | awk \'NR==2 {print $3 " of " $2 " used"}\')"; ' +
        'echo "Backups:"; ls -1t /var/backups/xposure 2>/dev/null | head -n 4 | sed "s/^/  /"',
    ),
};
if (!commands[command]) fail(`Unknown command "${command}". Use one of: ${Object.keys(commands).join(', ')}`);
await commands[command]();
