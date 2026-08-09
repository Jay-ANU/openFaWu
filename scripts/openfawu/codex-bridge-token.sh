#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.codex ]]; then
  "$ROOT_DIR/scripts/openfawu/codex-bridge-init.sh" --quiet
fi

TOKEN="$(grep '^OPENFAWU_CODEX_BRIDGE_TOKEN=' .env.codex | tail -1 | cut -d= -f2-)"
if [[ -z "$TOKEN" ]]; then
  echo "未找到桥接器 Token。" >&2
  exit 1
fi
printf '%s\n' "$TOKEN"
