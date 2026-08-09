#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

[[ -f .envs/.solo/.postgres ]] || {
  echo "尚未初始化。" >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source .envs/.solo/.postgres
set +a

mkdir -p backups/openfawu
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="backups/openfawu/openfawu-${STAMP}.sql.gz"

docker compose --env-file .env.solo -f solo.yml exec -T postgres \
  pg_dump --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip -9 > "$TARGET"

sha256sum "$TARGET" > "${TARGET}.sha256"
echo "数据库备份已生成：$TARGET"
