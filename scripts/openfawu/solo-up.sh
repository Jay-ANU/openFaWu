#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

[[ -f .env.solo && -f .envs/.solo/.django ]] || {
  echo "尚未初始化，请先执行 make -f openfawu.mk solo-init" >&2
  exit 1
}

docker compose --env-file .env.solo -f solo.yml up -d
