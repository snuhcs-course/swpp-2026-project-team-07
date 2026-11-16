#!/usr/bin/env bash
# AI-assisted backup helper, OpenAI Codex, Iteration 2 (2026-10-31).
set -euo pipefail
umask 077

if [[ "$(id -u)" != 0 ]]; then
    echo "Run this script as root on the Azure VM." >&2
    exit 1
fi
if (( $# > 1 )); then
    echo "Usage: $0 [private-backup-directory]" >&2
    exit 1
fi

backup_root=${1:-/var/backups/outloud}
if [[ "$backup_root" != /* || -L "$backup_root" ]]; then
    echo "Use an absolute, non-symlink backup directory." >&2
    exit 1
fi
if [[ ! -e "$backup_root" ]]; then
    mkdir -p -m 0700 -- "$backup_root"
fi
if [[ ! -d "$backup_root" || ! -O "$backup_root" || "$(stat -c '%a' "$backup_root")" != 700 ]]; then
    echo "The backup directory must be owned by root with mode 700." >&2
    exit 1
fi
exec 9>"$backup_root/.lock"
if ! flock -n 9; then
    echo "Another OutLoud backup is already running." >&2
    exit 1
fi

project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"
compose=(docker compose --env-file deploy/.env -f compose.production.yaml)
# Read only the resolved image/volume names; never print the resolved environment.
layout=$("${compose[@]}" config --format json | python3 -c \
    'import json,sys; c=json.load(sys.stdin); print(c["volumes"]["media_data"]["name"],c["services"]["api"]["image"])')
read -r media_volume backend_image <<<"$layout"
docker volume inspect "$media_volume" >/dev/null
docker image inspect "$backend_image" >/dev/null
running=$("${compose[@]}" ps --status running --services)
writers=()
while IFS= read -r service; do
    case "$service" in
        api|worker|scheduler) writers+=("$service") ;;
    esac
done <<<"$running"

created_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
backup_dir=$(mktemp -d "$backup_root/$(date -u +%Y%m%dT%H%M%SZ).XXXXXX")
restart_needed=0
finish() {
    status=$?
    trap - EXIT INT TERM
    if (( restart_needed )); then
        if ! "${compose[@]}" start "${writers[@]}" >&2; then
            echo "Could not resume all previously running writers. Check their state." >&2
            status=1
        fi
    fi
    if (( status == 0 )); then
        printf '%s\n' "$backup_dir"
    else
        echo "Backup failed; retained files are in $backup_dir." >&2
    fi
    exit "$status"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# shortcut: these are the stack's only writers; extend the list before adding a writer.
if (( ${#writers[@]} )); then
    restart_needed=1
    "${compose[@]}" stop --timeout 330 "${writers[@]}" >&2
fi
"${compose[@]}" exec -T db sh -c \
    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
    >"$backup_dir/database.dump"
"${compose[@]}" exec -T db pg_restore --list <"$backup_dir/database.dump" >/dev/null
docker run --rm --network none --read-only --user 0:0 \
    --mount "type=volume,source=$media_volume,target=/media,readonly" \
    --mount "type=bind,source=$backup_dir,target=/backup" \
    --entrypoint tar "$backend_image" -czf /backup/media.tar.gz -C /media .
chmod 0600 "$backup_dir/media.tar.gz"
tar -tzf "$backup_dir/media.tar.gz" >/dev/null
printf 'status=complete\ncreated_utc=%s\nbackend_image=%s\nenvironment_included=false\n' \
    "$created_utc" "$backend_image" >"$backup_dir/manifest.txt"
(
    cd "$backup_dir"
    sha256sum database.dump media.tar.gz manifest.txt >SHA256SUMS
    sha256sum --check SHA256SUMS >/dev/null
)
