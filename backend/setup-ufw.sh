#!/usr/bin/env bash
# Locks down the VPS firewall so only Cloudflare edge IPs can reach 80/443,
# with SSH left open for direct access. One-time setup, not part of the
# recurring CI/CD flow. Copied from ci-cd-template/setup-ufw.sh (generic,
# no project-specific values).
#
# SAFETY: this rewrites live firewall rules. Keep a second SSH session open
# while running this so you can undo (`ufw disable`) if something is wrong
# before you close your only connection to the box.
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root: sudo bash setup-ufw.sh"
  exit 1
fi

SSH_PORT="${SSH_PORT:-22}"

command -v ufw >/dev/null 2>&1 || { echo "ufw not found. Install it first (apt install ufw)."; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "curl not found. Install it first (apt install curl)."; exit 1; }

echo "[1/4] Allowing SSH on port ${SSH_PORT} (do this before anything else)"
ufw allow "${SSH_PORT}/tcp" comment "SSH"

echo "[2/4] Fetching current Cloudflare IP ranges"
CF_IPV4="$(curl -fsSL https://www.cloudflare.com/ips-v4)"
CF_IPV6="$(curl -fsSL https://www.cloudflare.com/ips-v6)"

if [ -z "$CF_IPV4" ] || [ -z "$CF_IPV6" ]; then
  echo "Failed to fetch Cloudflare IP ranges. Aborting without touching default policy."
  exit 1
fi

echo "[3/4] Allowing 80/443 from Cloudflare ranges only"
while IFS= read -r cidr; do
  [ -z "$cidr" ] && continue
  ufw allow from "$cidr" to any port 80,443 proto tcp comment "Cloudflare"
done <<< "$CF_IPV4"

while IFS= read -r cidr; do
  [ -z "$cidr" ] && continue
  ufw allow from "$cidr" to any port 80,443 proto tcp comment "Cloudflare"
done <<< "$CF_IPV6"

echo "[4/4] Setting default policy and enabling ufw"
ufw default deny incoming
ufw default allow outgoing
ufw --force enable

ufw status verbose
