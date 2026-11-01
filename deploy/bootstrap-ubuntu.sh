#!/usr/bin/env bash
# AI-assisted server setup, OpenAI Codex, Iteration 2 (2026-10-31; public HTTPS 2026-11-01).
set -euo pipefail

if (( EUID != 0 )); then
    echo "Run this script as root on the Azure VM." >&2
    exit 1
fi

. /etc/os-release
if [[ "$ID" != ubuntu || "$VERSION_ID" != 24.04 ]]; then
    echo "This setup requires Ubuntu 24.04." >&2
    exit 1
fi
id outloud >/dev/null

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-v2 python3

systemctl enable --now docker

install -d -m 0750 -o outloud -g outloud /srv/outloud
install -d -m 0700 -o root -g root /var/backups/outloud
docker compose version
echo "Docker packages are ready. Configure the public HTTPS edge before starting the app."
