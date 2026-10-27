#!/usr/bin/env bash
# One-time VPS provisioning: Docker Engine + swap + sysctl tuning. Run once
# on a fresh Ubuntu VPS before the first deploy-backend.yml push; not part of
# the recurring CI/CD flow.
#
# Run via `sudo bash vps-bootstrap.sh` as the same non-root user that
# deploy-backend.yml SSHes in as (e.g. `ubuntu` on an AWS EC2 Ubuntu AMI,
# which has no root login by default) — step 6 adds that invoking user to
# the `docker` group so it can run `docker compose` without sudo afterwards.
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root: sudo bash vps-bootstrap.sh"
  exit 1
fi

TARGET_USER="${SUDO_USER:-root}"

echo "[1/6] Updating Ubuntu packages"
apt update
apt upgrade -y

echo "[2/6] Installing Docker Engine + Docker Compose plugin"
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
fi

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "[3/6] Creating 2GB swap (if missing)"
if ! swapon --show | grep -q "/swapfile"; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
if ! grep -q "^/swapfile" /etc/fstab; then
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "[4/6] Applying swappiness and max_map_count"
cat > /etc/sysctl.d/99-pfm.conf <<'EOF'
vm.swappiness=10
vm.max_map_count=262144
EOF
sysctl -w vm.swappiness=10
sysctl -w vm.max_map_count=262144
sysctl --system > /dev/null

echo "[5/6] Setting Docker DNS defaults and restarting Docker"
mkdir -p /etc/docker
if [ -f /etc/docker/daemon.json ]; then
  cp /etc/docker/daemon.json /etc/docker/daemon.json.bak.$(date +%Y%m%d%H%M%S)
fi
cat > /etc/docker/daemon.json <<'EOF'
{
  "dns": ["8.8.8.8", "1.1.1.1"]
}
EOF

systemctl restart docker

echo "[6/6] Adding ${TARGET_USER} to the docker group (skip if root)"
if [ "$TARGET_USER" != "root" ]; then
  usermod -aG docker "$TARGET_USER"
  echo "Added. Log out and back in (or start a new SSH session) for it to take effect —"
  echo "each GitHub Actions SSH run opens a fresh session, so deploy-backend.yml is unaffected."
fi

echo "Done. Current values:"
sysctl vm.swappiness
sysctl vm.max_map_count
cat /etc/docker/daemon.json
docker --version
docker compose version
