#!/usr/bin/env bash
# Prepares an Ubuntu/Debian server for the Xposure website. Safe to run again: it re-applies
# settings and installs updates, and never touches the database or uploaded photos.
# Run from your computer with `npm run deploy:setup` (it uploads this folder and runs it as root).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
HERE="$(cd "$(dirname "$0")" && pwd)"

# Settings from deploy/deploy.config.json, written by scripts/deploy.mjs.
set -a
# shellcheck disable=SC1091
. "$HERE/setup.env"
set +a
rm -f "$HERE/setup.env"
: "${PRIMARY_DOMAIN:?}" "${SERVER_IP:?}" "${DEPLOY_PUBKEY:?}" "${ADMIN_EMAIL:?}"

step() { printf '\n\033[1m• %s\033[0m\n' "$*"; }

. /etc/os-release
case "${ID:-}" in ubuntu | debian) ;; *) echo "This script supports Ubuntu and Debian (found: ${PRETTY_NAME:-unknown})." >&2; exit 1 ;; esac

step "System updates"
apt-get update -q
apt-get -y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold upgrade
apt-get -y -q install ca-certificates curl gnupg ufw unattended-upgrades sqlite3 debian-keyring debian-archive-keyring apt-transport-https

step "Swap (the smallest droplets have 512 MB of memory)"
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
echo 'vm.swappiness=10' >/etc/sysctl.d/90-xposure.conf
sysctl -q --system

step "Node.js 24 (LTS) from NodeSource"
install -d -m 0755 /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/nodesource.gpg ]; then
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
fi
echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main' >/etc/apt/sources.list.d/nodesource.list
printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' >/etc/apt/preferences.d/nodejs

step "Caddy web server (automatic HTTPS)"
if [ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
fi
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
apt-get update -q
apt-get -y -q install nodejs caddy
node --version

step "Accounts: 'xposure' runs the site, 'deploy' uploads new versions"
id xposure >/dev/null 2>&1 || useradd --system --home-dir /var/lib/xposure --shell /usr/sbin/nologin xposure
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG systemd-journal deploy
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
echo "$DEPLOY_PUBKEY" >/home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys

step "Folders"
install -d -m 0755 -o root -g root /srv/xposure
install -d -m 0755 -o deploy -g deploy /srv/xposure/releases
install -d -m 0700 -o deploy -g deploy /srv/xposure/incoming
install -d -m 0750 -o xposure -g xposure /var/lib/xposure
install -d -m 0750 -o root -g deploy /var/backups/xposure
install -d -m 0750 -o root -g xposure /etc/xposure

step "Website settings (/etc/xposure/xposure.env)"
ENV_FILE=/etc/xposure/xposure.env
if [ ! -f "$ENV_FILE" ]; then
  cat >"$ENV_FILE" <<EOF
# Read by the xposure service. Restart after a change: sudo systemctl restart xposure
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATA_DIR=/var/lib/xposure
PUBLIC_ORIGIN=https://$PRIMARY_DOMAIN
# Optional Zoom connection (see README):
# ZOOM_ACCOUNT_ID=
# ZOOM_CLIENT_ID=
# ZOOM_CLIENT_SECRET=
# First admin account. The password line is removed automatically once the account exists.
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
EOF
else
  sed -i "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=https://$PRIMARY_DOMAIN|" "$ENV_FILE"
fi
chown root:xposure "$ENV_FILE"
chmod 0640 "$ENV_FILE"

step "Service, release and backup commands"
install -m 0755 -o root -g root "$HERE/xposure-deploy" /usr/local/bin/xposure-deploy
install -m 0750 -o root -g root "$HERE/xposure-activate" /usr/local/sbin/xposure-activate
install -m 0750 -o root -g root "$HERE/xposure-backup" /usr/local/sbin/xposure-backup
install -m 0644 "$HERE/xposure.service" /etc/systemd/system/xposure.service
install -m 0644 "$HERE/xposure-backup.service" /etc/systemd/system/xposure-backup.service
install -m 0644 "$HERE/xposure-backup.timer" /etc/systemd/system/xposure-backup.timer
cat >/etc/sudoers.d/xposure <<'EOF'
# The deploy account may switch releases (the command checks its arguments) and nothing else.
deploy ALL=(root) NOPASSWD: /usr/local/sbin/xposure-activate
EOF
chmod 0440 /etc/sudoers.d/xposure
visudo -cqf /etc/sudoers.d/xposure
systemctl daemon-reload
systemctl enable xposure.service >/dev/null
systemctl enable --now xposure-backup.timer >/dev/null

step "Caddy: HTTPS for $PRIMARY_DOMAIN"
{
  echo "# Written by deploy/server/setup.sh. Change deploy/deploy.config.json and run npm run deploy:setup."
  echo
  echo "$PRIMARY_DOMAIN {"
  echo "	header -Server"
  echo "	reverse_proxy 127.0.0.1:3000"
  echo "	log {"
  echo "		output file /var/log/caddy/xposure.log {"
  echo "			roll_size 10MiB"
  echo "			roll_keep 5"
  echo "		}"
  echo "	}"
  echo "}"
  if [ -n "${REDIRECT_DOMAINS:-}" ]; then
    echo
    echo "$(echo "$REDIRECT_DOMAINS" | tr ' ' ',' | sed 's/,/, /g') {"
    echo "	redir https://$PRIMARY_DOMAIN{uri} permanent"
    echo "}"
  fi
  echo
  echo "http://$SERVER_IP {"
  echo "	redir https://$PRIMARY_DOMAIN{uri} permanent"
  echo "}"
} >/etc/caddy/Caddyfile
# Validate as Caddy's own user, so any log file it creates belongs to Caddy.
install -d -o caddy -g caddy /var/log/caddy
chown -R caddy:caddy /var/log/caddy
runuser -u caddy -- caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ||
  { runuser -u caddy -- caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; exit 1; }
systemctl enable caddy >/dev/null
systemctl reload-or-restart caddy

step "Firewall: only SSH, HTTP and HTTPS"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ufw status | sed -n '1,12p'

step "SSH: keys only, no passwords"
if [ -s /root/.ssh/authorized_keys ]; then
  cat >/etc/ssh/sshd_config.d/10-xposure.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
fi

step "Automatic security updates (restart at 01:30 UTC if an update needs it)"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat >/etc/apt/apt.conf.d/52xposure-unattended <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "01:30";
EOF

step "Log size limit"
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' >/etc/systemd/journald.conf.d/xposure.conf
systemctl restart systemd-journald

rm -rf "$HERE"
printf '\n\033[1m✓ Server ready.\033[0m Next: npm run deploy\n'
