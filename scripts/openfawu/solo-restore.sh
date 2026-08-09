#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FILE="${1:-}"
[[ -n "$FILE" && -f "$FILE" ]] || {
  echo "用法：$0 backups/openfawu/<backup>.sql.gz" >&2
  exit 1
}

set -a
# shellcheck disable=SC1091
source .envs/.solo/.postgres
set +a

read -r -p "恢复将覆盖当前数据库中的同名对象，输入 RESTORE 继续：" confirm
[[ "$confirm" == "RESTORE" ]] || exit 1

gzip -dc "$FILE" | docker compose --env-file .env.solo -f solo.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "恢复完成。"
